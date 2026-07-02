DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('REMITO', 'FACTURA', 'NOTA_CREDITO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('PROCESSING', 'AVAILABLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS document_sequence (
  id uuid PRIMARY KEY,
  type document_type NOT NULL,
  series text NOT NULL,
  next_number bigint NOT NULL DEFAULT 1,
  CONSTRAINT document_sequence_next_number_positive CHECK (next_number >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS document_sequence_type_series_unique ON document_sequence(type, series);

CREATE TABLE IF NOT EXISTS commercial_document (
  id uuid PRIMARY KEY,
  type document_type NOT NULL,
  series text NOT NULL DEFAULT 'A',
  number bigint NOT NULL,
  display_number text NOT NULL,
  order_id uuid REFERENCES "order"(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES customer(id) ON DELETE RESTRICT,
  status document_status NOT NULL DEFAULT 'PROCESSING',
  issued_at timestamptz,
  total_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  pdf_storage_key text,
  pdf_checksum text,
  content_hash text NOT NULL,
  related_document_id uuid,
  created_by uuid NOT NULL REFERENCES admin_user(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_document_total_non_negative CHECK (total_minor >= 0),
  CONSTRAINT commercial_document_available_has_file CHECK (status <> 'AVAILABLE' OR (issued_at IS NOT NULL AND pdf_storage_key IS NOT NULL AND pdf_checksum IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_document_type_series_number_unique ON commercial_document(type, series, number);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_document_type_series_display_unique ON commercial_document(type, series, display_number);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_document_available_order_type_unique ON commercial_document(type, order_id) WHERE status = 'AVAILABLE' AND order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commercial_document_order_idx ON commercial_document(order_id);
CREATE INDEX IF NOT EXISTS commercial_document_customer_idx ON commercial_document(customer_id);
CREATE INDEX IF NOT EXISTS commercial_document_created_idx ON commercial_document(created_at);

CREATE TABLE IF NOT EXISTS document_download (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES commercial_document(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'admin',
  reason text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_download_document_created_idx ON document_download(document_id, created_at);
CREATE INDEX IF NOT EXISTS document_download_actor_created_idx ON document_download(actor_id, created_at);

CREATE TABLE IF NOT EXISTS finance_period_snapshot (
  id uuid PRIMARY KEY,
  period text NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  revenue_minor integer NOT NULL DEFAULT 0,
  cost_minor integer NOT NULL DEFAULT 0,
  margin_minor integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  source_version text NOT NULL DEFAULT 'orders.v1',
  is_stale boolean NOT NULL DEFAULT false,
  CONSTRAINT finance_period_snapshot_amounts_valid CHECK (revenue_minor >= 0 AND cost_minor >= 0 AND margin_minor = revenue_minor - cost_minor),
  CONSTRAINT finance_period_snapshot_orders_non_negative CHECK (orders_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_period_snapshot_period_currency_unique ON finance_period_snapshot(period, currency);
CREATE INDEX IF NOT EXISTS finance_period_snapshot_period_idx ON finance_period_snapshot(period);
