-- The overbooking rule. One rule in the database guards every door: guests booking at once,
-- payments (also late or repeated ones), and staff cutting allotment or closing nights.

-- Per room type per night: what the website may sell and what is taken.
-- A hold counts only until it expires (lazy expiry: no job has to clean up).
CREATE VIEW night_usage AS
SELECT n.room_type_id,
       n.night,
       n.rate_inr,
       n.allotment,
       n.closed,
       CASE WHEN n.closed THEN 0 ELSE n.allotment END AS allotment_effective,
       u.sold,
       u.held,
       u.sold + u.held AS active,
       greatest((CASE WHEN n.closed THEN 0 ELSE n.allotment END) - u.sold - u.held, 0) AS remaining
FROM inventory_night n
CROSS JOIN LATERAL (
  SELECT coalesce(sum(r.qty) FILTER (WHERE r.status = 'confirmed'), 0)::int AS sold,
         coalesce(sum(r.qty) FILTER (WHERE r.status = 'held' AND r.expires_at > now()), 0)::int AS held
  FROM reservation r
  WHERE r.room_type_id = n.room_type_id
    AND r.check_in <= n.night AND r.check_out > n.night
    AND r.status IN ('held', 'confirmed')
) u;

-- Raises 23514 (check_violation) if any night in [p_from, p_to) is missing or over-full.
-- VOLATILE on purpose: each statement takes a fresh snapshot, so after waiting for the row locks
-- the check sees whatever the transaction that held them committed.
CREATE FUNCTION assert_capacity(p_room_type text, p_from date, p_to date) RETURNS void
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  locked int;
  missing date;
  bad record;
BEGIN
  -- 1. Serialise everyone touching these nights. Date order everywhere, so no deadlocks.
  PERFORM 1 FROM inventory_night
   WHERE room_type_id = p_room_type AND night >= p_from AND night < p_to
   ORDER BY night FOR UPDATE;
  GET DIAGNOSTICS locked = ROW_COUNT;
  IF locked < p_to - p_from THEN
    SELECT d::date INTO missing FROM generate_series(p_from, p_to - 1, interval '1 day') d
     WHERE NOT EXISTS (SELECT 1 FROM inventory_night WHERE room_type_id = p_room_type AND night = d::date)
     ORDER BY d LIMIT 1;
    RAISE EXCEPTION 'night not for sale'
      USING ERRCODE = '23514', DETAIL = format('Night %s of %s is not for sale', missing, p_room_type);
  END IF;

  -- 2. A separate statement, so it sees the commits we waited for.
  SELECT night, active, allotment_effective INTO bad FROM night_usage
   WHERE room_type_id = p_room_type AND night >= p_from AND night < p_to
     AND active > allotment_effective
   ORDER BY night LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'sold out'
      USING ERRCODE = '23514',
            DETAIL = format('Night %s of %s has %s committed, website allotment %s', bad.night, p_room_type, bad.active, bad.allotment_effective);
  END IF;
END $$;

CREATE FUNCTION reservation_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM assert_capacity(NEW.room_type_id, NEW.check_in, NEW.check_out);
  RETURN NULL;
END $$;

CREATE TRIGGER reservation_capacity AFTER INSERT OR UPDATE ON reservation
  FOR EACH ROW WHEN (NEW.status IN ('held', 'confirmed'))
  EXECUTE FUNCTION reservation_capacity();

CREATE FUNCTION inventory_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM assert_capacity(NEW.room_type_id, NEW.night, NEW.night + 1);
  RETURN NULL;
END $$;

CREATE TRIGGER inventory_capacity AFTER UPDATE ON inventory_night
  FOR EACH ROW EXECUTE FUNCTION inventory_capacity();
