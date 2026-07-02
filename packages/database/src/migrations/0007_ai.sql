CREATE TYPE ai_generation_kind AS ENUM ('DESCRIPTION', 'SPECS', 'SEO', 'IMAGE', 'RECOMMENDATION', 'TRENDS', 'PRICING');

CREATE TYPE ai_generation_status AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL', 'DEGRADED');

CREATE TYPE ai_target_type AS ENUM ('PRODUCT', 'VARIANT', 'CATEGORY', 'SUPPLIER_FEED', 'NONE');

CREATE TYPE ai_alert_kind AS ENUM ('PRICE', 'STOCK', 'TREND');

CREATE TYPE ai_alert_status AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED');

CREATE TABLE IF NOT EXISTS ai_generation (
  id uuid PRIMARY KEY,
  kind ai_generation_kind NOT NULL,
  target_type ai_target_type NOT NULL DEFAULT 'NONE',
  target_id uuid,
  prompt_ref text NOT NULL,
  status ai_generation_status NOT NULL DEFAULT 'QUEUED',
  cost_estimate_minor integer,
  currency text NOT NULL DEFAULT 'ARS',
  error_code text,
  actor_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT ai_generation_cost_positive CHECK (cost_estimate_minor IS NULL OR cost_estimate_minor >= 0)
);

CREATE INDEX IF NOT EXISTS ai_generation_actor_created_idx ON ai_generation(actor_id, created_at);

CREATE INDEX IF NOT EXISTS ai_generation_target_idx ON ai_generation(target_type, target_id);

CREATE INDEX IF NOT EXISTS ai_generation_kind_status_idx ON ai_generation(kind, status);

CREATE INDEX IF NOT EXISTS ai_generation_created_idx ON ai_generation(created_at);

CREATE TABLE IF NOT EXISTS ai_alert (
  id uuid PRIMARY KEY,
  kind ai_alert_kind NOT NULL,
  payload jsonb NOT NULL,
  dedupe_key text,
  status ai_alert_status NOT NULL DEFAULT 'OPEN',
  resolution_note text,
  resolved_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_alert_status_created_idx ON ai_alert(status, created_at);

CREATE INDEX IF NOT EXISTS ai_alert_kind_idx ON ai_alert(kind);

CREATE INDEX IF NOT EXISTS ai_alert_dedupe_idx ON ai_alert(dedupe_key, status);
