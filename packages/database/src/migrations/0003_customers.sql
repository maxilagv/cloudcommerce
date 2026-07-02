DO $$ BEGIN
  CREATE TYPE customer_tier AS ENUM ('CloudBase', 'CloudPlus', 'CloudPrime');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE customer_consent_kind AS ENUM ('marketing_whatsapp', 'marketing_email', 'data_processing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE customer_contact_channel AS ENUM ('call', 'whatsapp', 'email', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE customer_contact_direction AS ENUM ('in', 'out');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS customer (
  id uuid PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  display_name text NOT NULL,
  email text,
  whatsapp text,
  notes text,
  tier customer_tier NOT NULL DEFAULT 'CloudBase',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_email ON customer(lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON customer USING gin (to_tsvector('spanish', coalesce(first_name, '') || ' ' || coalesce(last_name, '')));
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customer(whatsapp);
CREATE INDEX IF NOT EXISTS idx_customers_created ON customer(created_at, id);

CREATE TABLE IF NOT EXISTS customer_address (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  label text,
  recipient_name text,
  province text NOT NULL,
  city text NOT NULL,
  street text NOT NULL,
  street_number text,
  between_streets text,
  postal_code text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_address_customer ON customer_address(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_primary_address ON customer_address(customer_id) WHERE is_primary = true;

CREATE TABLE IF NOT EXISTS customer_consent (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  kind customer_consent_kind NOT NULL,
  granted boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_consent_customer_kind ON customer_consent(customer_id, kind);

CREATE TABLE IF NOT EXISTS customer_contact_log (
  id uuid PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  channel customer_contact_channel NOT NULL,
  direction customer_contact_direction NOT NULL DEFAULT 'in',
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contactlog_customer_occurred ON customer_contact_log(customer_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_contactlog_calls ON customer_contact_log(customer_id, occurred_at) WHERE channel = 'call';
