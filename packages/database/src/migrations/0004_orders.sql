DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_channel AS ENUM ('store', 'admin_manual');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cart_status AS ENUM ('active', 'converted', 'abandoned');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shipment_status AS ENUM ('CREATED', 'PREPARED', 'DISPATCHED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELAYED', 'FAILED_ATTEMPT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE shipping_method AS ENUM ('STANDARD', 'EXPRESS', 'PICKUP');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cart (
  id uuid PRIMARY KEY,
  customer_id uuid REFERENCES customer(id) ON DELETE SET NULL,
  status cart_status NOT NULL DEFAULT 'active',
  currency text NOT NULL DEFAULT 'ARS',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_cart_customer ON cart(customer_id);
CREATE INDEX IF NOT EXISTS cart_status_expiry_idx ON cart(status, expires_at);

CREATE TABLE IF NOT EXISTS cart_item (
  id uuid PRIMARY KEY,
  cart_id uuid NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_price_snapshot_minor integer NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_item_quantity_positive CHECK (quantity >= 1),
  CONSTRAINT cart_item_price_non_negative CHECK (unit_price_snapshot_minor >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_item_cart_variant_unique ON cart_item(cart_id, variant_id);
CREATE INDEX IF NOT EXISTS cart_item_cart_idx ON cart_item(cart_id);

CREATE TABLE IF NOT EXISTS "order" (
  id uuid PRIMARY KEY,
  order_number text NOT NULL,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  status order_status NOT NULL,
  channel order_channel NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  subtotal_minor integer NOT NULL,
  shipping_minor integer NOT NULL,
  discount_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL,
  shipping_method shipping_method NOT NULL,
  shipping_address_id uuid REFERENCES customer_address(id) ON DELETE RESTRICT,
  placed_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  notes text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_amounts_non_negative CHECK (subtotal_minor >= 0 AND shipping_minor >= 0 AND discount_minor >= 0 AND tax_minor >= 0 AND total_minor >= 0),
  CONSTRAINT order_total_matches_components CHECK (total_minor = subtotal_minor + shipping_minor + tax_minor - discount_minor),
  CONSTRAINT order_shipping_address_required CHECK (shipping_method = 'PICKUP' OR shipping_address_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS order_number_unique ON "order"(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON "order"(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON "order"(status);
CREATE INDEX IF NOT EXISTS order_created_idx ON "order"(created_at, id);

CREATE TABLE IF NOT EXISTS order_line (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE RESTRICT,
  product_title_snapshot text NOT NULL,
  sku_snapshot text,
  quantity integer NOT NULL,
  unit_price_minor integer NOT NULL,
  line_total_minor integer NOT NULL,
  supplier_cost_snapshot_minor integer,
  CONSTRAINT order_line_quantity_positive CHECK (quantity >= 1),
  CONSTRAINT order_line_unit_price_non_negative CHECK (unit_price_minor >= 0),
  CONSTRAINT order_line_supplier_cost_non_negative CHECK (supplier_cost_snapshot_minor IS NULL OR supplier_cost_snapshot_minor >= 0),
  CONSTRAINT order_line_total_matches CHECK (line_total_minor = unit_price_minor * quantity)
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_line(order_id);
CREATE INDEX IF NOT EXISTS order_line_variant_idx ON order_line(variant_id);

CREATE TABLE IF NOT EXISTS order_status_event (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  reason text,
  actor_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_status_event_order_created_idx ON order_status_event(order_id, created_at);

CREATE TABLE IF NOT EXISTS shipment (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES "order"(id) ON DELETE CASCADE,
  carrier text,
  tracking_code text,
  status shipment_status NOT NULL DEFAULT 'CREATED',
  eta timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipment(order_id);
CREATE INDEX IF NOT EXISTS shipment_tracking_idx ON shipment(carrier, tracking_code);

CREATE TABLE IF NOT EXISTS shipment_event (
  id uuid PRIMARY KEY,
  shipment_id uuid NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  status shipment_status NOT NULL,
  description text,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS shipment_event_shipment_occurred_idx ON shipment_event(shipment_id, occurred_at);

CREATE TABLE IF NOT EXISTS idempotency_key (
  id uuid PRIMARY KEY,
  key text NOT NULL,
  route text NOT NULL,
  actor_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_ref_type text,
  response_ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_key_route_key_actor_unique ON idempotency_key(route, key, actor_id);
CREATE INDEX IF NOT EXISTS idx_idem_key ON idempotency_key(key);
CREATE INDEX IF NOT EXISTS idempotency_key_expires_idx ON idempotency_key(expires_at);
