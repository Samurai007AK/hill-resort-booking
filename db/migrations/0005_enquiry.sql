ALTER TABLE enquiry ADD COLUMN ai_response jsonb;
ALTER TABLE enquiry ADD COLUMN consent_at timestamptz;
ALTER TABLE enquiry ADD COLUMN idempotency_key text UNIQUE;
ALTER TABLE enquiry ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
CREATE TABLE enquiry_rate_limit (
  fingerprint text NOT NULL,
  bucket bigint NOT NULL,
  hits integer NOT NULL DEFAULT 1,
  PRIMARY KEY (fingerprint, bucket)
);
CREATE INDEX enquiry_lane_received ON enquiry(lane, received_at DESC);
