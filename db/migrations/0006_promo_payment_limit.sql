-- Count a limited promo atomically with successful confirmation. Competing
-- discounted holds can coexist; a paid hold that loses the last use needs a refund.
CREATE OR REPLACE FUNCTION apply_payment(p_payment_id text, p_reservation_id uuid, p_amount int, p_success boolean)
RETURNS TABLE (outcome text, reservation_status text, late boolean, replay boolean)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  r reservation;
  prior payment;
  o text;
BEGIN
  SELECT * INTO r FROM reservation WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown reservation %', p_reservation_id USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO prior FROM payment WHERE payment_id = p_payment_id;
  IF FOUND THEN
    RETURN QUERY SELECT prior.outcome, r.status, r.late, true;
    RETURN;
  END IF;

  IF NOT p_success OR p_amount <> r.quoted_total THEN
    o := 'rejected';
  ELSIF r.status = 'held' THEN
    BEGIN
      IF r.promo_code IS NOT NULL THEN
        UPDATE promo SET uses = uses + 1
         WHERE code = r.promo_code AND (max_uses IS NULL OR uses < max_uses);
        IF NOT FOUND THEN
          RAISE EXCEPTION 'promo usage limit reached' USING ERRCODE = '23514';
        END IF;
      END IF;
      UPDATE reservation SET status = 'confirmed', late = (r.expires_at <= now()) WHERE id = r.id;
      o := 'confirmed';
    EXCEPTION WHEN check_violation THEN
      UPDATE reservation SET status = 'refund_due' WHERE id = r.id;
      o := 'refund_due';
    END;
  ELSE
    o := 'refund_due';
  END IF;

  INSERT INTO payment (payment_id, reservation_id, amount, outcome) VALUES (p_payment_id, r.id, p_amount, o);
  RETURN QUERY SELECT o, x.status, x.late, false FROM reservation x WHERE x.id = r.id;
END $$;
