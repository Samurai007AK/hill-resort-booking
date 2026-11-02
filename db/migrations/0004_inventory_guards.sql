-- Guards on inventory_night that the capacity trigger (0002) does not cover.

-- Rates between Rs 1,000 and Rs 5,00,000 a night (A15; ASCII only: local Postgres may be WIN1252): catches a typo like 95 or 9500000.
ALTER TABLE inventory_night DROP CONSTRAINT inventory_night_rate_inr_check;
ALTER TABLE inventory_night ADD CONSTRAINT inventory_night_rate_inr_check CHECK (rate_inr BETWEEN 1000 AND 500000);

-- The website can never be offered more keys than the room type has.
CREATE FUNCTION inventory_allotment_within_keys() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  keys int;
BEGIN
  SELECT keys_total INTO keys FROM room_types WHERE id = NEW.room_type_id;
  IF NEW.allotment > keys THEN
    RAISE EXCEPTION 'allotment over keys'
      USING ERRCODE = '23514',
            DETAIL = format('Night %s of %s: allotment %s, but the room type has only %s keys', NEW.night, NEW.room_type_id, NEW.allotment, keys);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER inventory_allotment_within_keys BEFORE INSERT OR UPDATE OF allotment ON inventory_night
  FOR EACH ROW EXECUTE FUNCTION inventory_allotment_within_keys();

-- A night with confirmed guests or live holds cannot vanish from under them.
-- The row is locked before a BEFORE ROW trigger runs, so a booking racing this delete is serialised
-- by the same lock assert_capacity takes; this statement then sees that booking's commit.
CREATE FUNCTION inventory_keep_booked_nights() RETURNS trigger LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  n int;
BEGIN
  SELECT active INTO n FROM night_usage WHERE room_type_id = OLD.room_type_id AND night = OLD.night;
  IF n > 0 THEN
    RAISE EXCEPTION 'night has guests'
      USING ERRCODE = '23514',
            DETAIL = format('Night %s of %s has %s committed; close it instead of deleting it', OLD.night, OLD.room_type_id, n);
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER inventory_keep_booked_nights BEFORE DELETE ON inventory_night
  FOR EACH ROW EXECUTE FUNCTION inventory_keep_booked_nights();
