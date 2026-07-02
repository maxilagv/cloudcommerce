CREATE TABLE IF NOT EXISTS setting (
  id uuid PRIMARY KEY,
  key text NOT NULL,
  value jsonb NOT NULL,
  scope text NOT NULL DEFAULT 'business',
  updated_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT setting_scope_valid CHECK (scope IN ('business', 'public'))
);

CREATE UNIQUE INDEX IF NOT EXISTS setting_key_unique ON setting(key);
CREATE INDEX IF NOT EXISTS setting_scope_idx ON setting(scope);
CREATE INDEX IF NOT EXISTS setting_updated_by_idx ON setting(updated_by, updated_at);

CREATE TABLE IF NOT EXISTS feature_flag (
  id uuid PRIMARY KEY,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  owner text NOT NULL,
  review_at date NOT NULL,
  removal_plan text,
  description text NOT NULL,
  updated_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS feature_flag_key_unique ON feature_flag(key);
CREATE INDEX IF NOT EXISTS feature_flag_enabled_idx ON feature_flag(enabled);
CREATE INDEX IF NOT EXISTS feature_flag_owner_idx ON feature_flag(owner);
CREATE INDEX IF NOT EXISTS feature_flag_review_at_idx ON feature_flag(review_at);
