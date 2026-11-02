-- Core schema. Amounts are whole rupees (int). Dates are calendar dates in Asia/Kolkata.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE CHECK (email = lower(email)),
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('guest', 'staff', 'gm')),
  team          text CHECK (team IN ('reservations', 'sales')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((role = 'staff') = (team IS NOT NULL))  -- staff, and only staff, belong to a team
);

CREATE TABLE room_types (
  id           text PRIMARY KEY,                 -- slug, e.g. 'coffee-villa'
  name         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('room', 'villa')),
  keys_total   int  NOT NULL CHECK (keys_total > 0),
  max_adults   int  NOT NULL CHECK (max_adults > 0),
  max_children int  NOT NULL CHECK (max_children >= 0),
  description  text NOT NULL,
  photos       text[] NOT NULL DEFAULT '{}',
  sort_order   int  NOT NULL DEFAULT 0
);

CREATE TABLE rate_plans (
  id           text PRIMARY KEY,                 -- e.g. 'coffee-villa-flex'
  room_type_id text NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  name         text NOT NULL,
  factor       numeric(3,2) NOT NULL CHECK (factor > 0 AND factor <= 1),
  refundable   boolean NOT NULL,
  breakfast    boolean NOT NULL,
  UNIQUE (room_type_id, name)
);

-- One row per room type per night: rate, website allotment, closed flag. No row = not for sale.
CREATE TABLE inventory_night (
  room_type_id text NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  night        date NOT NULL,
  rate_inr     int  NOT NULL CHECK (rate_inr > 0),
  allotment    int  NOT NULL CHECK (allotment >= 0),
  closed       boolean NOT NULL DEFAULT false,
  PRIMARY KEY (room_type_id, night)
);

-- 'CS-' + 4 characters without look-alikes (no 0/O, 1/I/L).
CREATE FUNCTION gen_ref() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'CS-' || string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + floor(random() * 31)::int, 1), '')
  FROM generate_series(1, 4)
$$;

CREATE TABLE reservation (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref             text NOT NULL UNIQUE DEFAULT gen_ref(),
  room_type_id    text NOT NULL REFERENCES room_types(id),
  rate_plan_id    text NOT NULL REFERENCES rate_plans(id),
  check_in        date NOT NULL,
  check_out       date NOT NULL,
  qty             int  NOT NULL CHECK (qty BETWEEN 1 AND 4),
  adults          int  NOT NULL DEFAULT 2 CHECK (adults >= 1),
  children        int  NOT NULL DEFAULT 0 CHECK (children >= 0),
  status          text NOT NULL CHECK (status IN ('held', 'confirmed', 'cancelled', 'refund_due')),
  expires_at      timestamptz,
  quoted_total    int  NOT NULL CHECK (quoted_total >= 0),
  price_lines     jsonb NOT NULL,
  promo_code      text,
  guest_name      text NOT NULL,
  guest_email     text NOT NULL,
  guest_phone     text NOT NULL,
  consent_at      timestamptz NOT NULL,          -- DPDP consent, required to book
  idempotency_key text UNIQUE,
  late            boolean NOT NULL DEFAULT false, -- paid after the hold expired
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in),
  CHECK (check_out - check_in <= 30),
  CHECK (status <> 'held' OR expires_at IS NOT NULL)
);
CREATE INDEX reservation_room_dates ON reservation (room_type_id, check_in, check_out)
  WHERE status IN ('held', 'confirmed');

CREATE TABLE payment (
  payment_id     text PRIMARY KEY,               -- the gateway's id; a replay hits this key
  reservation_id uuid NOT NULL REFERENCES reservation(id),
  amount         int  NOT NULL,
  outcome        text NOT NULL CHECK (outcome IN ('confirmed', 'refund_due', 'rejected')),
  received_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE promo (
  code        text PRIMARY KEY CHECK (code = upper(code)),
  kind        text NOT NULL CHECK (kind IN ('percent', 'flat')),
  value       int  NOT NULL CHECK (value > 0),
  valid_from  date NOT NULL,
  valid_to    date NOT NULL,
  min_nights  int  NOT NULL DEFAULT 1 CHECK (min_nights >= 1),
  max_uses    int  CHECK (max_uses > 0),         -- null = no limit
  uses        int  NOT NULL DEFAULT 0 CHECK (uses >= 0),
  active      boolean NOT NULL DEFAULT true,
  CHECK (kind <> 'percent' OR value <= 100),
  CHECK (valid_to >= valid_from)
);

CREATE TABLE enquiry (
  id             text PRIMARY KEY CHECK (id ~ '^ENQ-[0-9]+$'),
  source         text NOT NULL CHECK (source IN ('web', 'email', 'whatsapp', 'event_form')),
  sender_name    text,
  contact        text,
  raw_text       text NOT NULL,
  redacted_text  text NOT NULL,                  -- the only text that may reach the AI
  received_at    timestamptz NOT NULL DEFAULT now(),
  category       text CHECK (category IN ('room', 'wedding', 'offsite', 'complaint', 'other')),
  confidence     numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  extracted      jsonb,
  lane           text NOT NULL DEFAULT 'unsorted' CHECK (lane IN ('unsorted', 'rooms', 'events', 'complaints')),
  owner_team     text CHECK (owner_team IN ('reservations', 'sales', 'gm')),
  gm_alert       boolean NOT NULL DEFAULT false,
  ai_status      text CHECK (ai_status IN ('ok', 'fallback', 'off')),
  ai_reason      text,
  ai_model       text,
  draft          text,
  draft_status   text CHECK (draft_status IN ('draft', 'sent')),
  first_reply_at timestamptz
);
CREATE SEQUENCE enquiry_seq START 4413;  -- after the brief's samples ENQ-4410..4412

-- Append-only audit trail: no UPDATE or DELETE (TRUNCATE is left for the demo reset).
CREATE TABLE enquiry_event (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  enquiry_id text NOT NULL REFERENCES enquiry(id),
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL,                      -- 'ai', 'system' or a user email
  kind       text NOT NULL,
  detail     jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX enquiry_event_enquiry ON enquiry_event (enquiry_id, at);

CREATE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END $$;
CREATE TRIGGER enquiry_event_append_only BEFORE UPDATE OR DELETE ON enquiry_event
  FOR EACH ROW EXECUTE FUNCTION forbid_change();

CREATE TABLE ai_cache (
  hash           text PRIMARY KEY,               -- hash of model + prompt version + redacted text
  model          text NOT NULL,
  prompt_version text NOT NULL,
  response       jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);
