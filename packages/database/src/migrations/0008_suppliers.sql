CREATE TYPE supplier_feed_kind AS ENUM ('csv', 'api');

CREATE TYPE supplier_feed_status AS ENUM ('IDLE', 'RUNNING', 'OK', 'PARTIAL', 'FAILED', 'DISABLED');

CREATE TYPE supplier_sync_status AS ENUM ('LINKED', 'PENDING_REVIEW', 'CONFLICT', 'DISCONTINUED');

CREATE TYPE supplier_forward_status AS ENUM ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'FAILED');

CREATE TABLE IF NOT EXISTS supplier (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  contact jsonb,
  api_config_enc text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_slug_unique ON supplier(slug);

CREATE INDEX IF NOT EXISTS supplier_active_idx ON supplier(is_active);

CREATE TABLE IF NOT EXISTS supplier_feed (
  id uuid PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  kind supplier_feed_kind NOT NULL,
  source_url text,
  schedule text,
  field_map jsonb,
  status supplier_feed_status NOT NULL DEFAULT 'IDLE',
  last_run_at timestamptz,
  last_run_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supplier_feed_supplier_idx ON supplier_feed(supplier_id);

CREATE TABLE IF NOT EXISTS supplier_product_map (
  id uuid PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  variant_id uuid REFERENCES product_variant(id) ON DELETE SET NULL,
  raw jsonb NOT NULL,
  content_hash text,
  sync_status supplier_sync_status NOT NULL DEFAULT 'PENDING_REVIEW',
  last_seen_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_product_map_supplier_external_unique ON supplier_product_map(supplier_id, external_id);

CREATE INDEX IF NOT EXISTS supplier_product_map_variant_idx ON supplier_product_map(variant_id);

CREATE INDEX IF NOT EXISTS supplier_product_map_status_idx ON supplier_product_map(supplier_id, sync_status);

CREATE TABLE IF NOT EXISTS supplier_order_ref (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES supplier(id) ON DELETE RESTRICT,
  external_order_id text,
  status supplier_forward_status NOT NULL DEFAULT 'PENDING',
  idempotency_key text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_order_ref_order_supplier_unique ON supplier_order_ref(order_id, supplier_id);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_order_ref_idempotency_unique ON supplier_order_ref(idempotency_key);

CREATE INDEX IF NOT EXISTS supplier_order_ref_external_idx ON supplier_order_ref(supplier_id, external_order_id);

CREATE INDEX IF NOT EXISTS supplier_order_ref_status_idx ON supplier_order_ref(status);

CREATE TABLE IF NOT EXISTS supplier_webhook_event (
  id uuid PRIMARY KEY,
  supplier_id uuid NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_webhook_event_unique ON supplier_webhook_event(supplier_id, event_id);
