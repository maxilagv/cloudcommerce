DO $$ BEGIN
  CREATE TYPE pricing_scope AS ENUM ('global', 'category', 'product');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_value_kind AS ENUM ('percent', 'fixed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE price_origin AS ENUM ('COMPUTED', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stock_movement_type AS ENUM ('IMPORT', 'SALE', 'RETURN', 'ADJUSTMENT', 'RESERVATION', 'RELEASE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  request_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx ON audit_log(actor_id, created_at);
CREATE INDEX IF NOT EXISTS audit_log_resource_idx ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_log_action_created_idx ON audit_log(action, created_at);

CREATE TABLE IF NOT EXISTS price_list (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'ARS'
);

CREATE UNIQUE INDEX IF NOT EXISTS price_list_name_unique ON price_list(name);
CREATE INDEX IF NOT EXISTS price_list_currency_default_idx ON price_list(currency, is_default);
CREATE UNIQUE INDEX IF NOT EXISTS price_list_single_default_per_currency ON price_list(currency) WHERE is_default = true;

CREATE TABLE IF NOT EXISTS supplier_cost (
  id uuid PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  supplier_id uuid,
  cost_amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_cost_non_negative CHECK (cost_amount_minor >= 0),
  CONSTRAINT supplier_cost_validity_order CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_supplier_cost_variant_valid ON supplier_cost(variant_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS supplier_cost_variant_active_idx ON supplier_cost(variant_id, currency) WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS markup_rule (
  id uuid PRIMARY KEY,
  scope pricing_scope NOT NULL,
  scope_id uuid,
  kind pricing_value_kind NOT NULL,
  value integer NOT NULL,
  min_margin_bps integer,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT markup_rule_value_non_negative CHECK (value >= 0),
  CONSTRAINT markup_rule_min_margin_range CHECK (min_margin_bps IS NULL OR (min_margin_bps >= 0 AND min_margin_bps <= 9500)),
  CONSTRAINT markup_rule_scope_id_required CHECK ((scope = 'global' AND scope_id IS NULL) OR (scope <> 'global' AND scope_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_markup_scope_active ON markup_rule(scope, scope_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS markup_rule_active_scope_unique ON markup_rule(scope, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS price (
  id uuid PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES price_list(id) ON DELETE RESTRICT,
  amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  compare_at_amount_minor integer,
  origin price_origin NOT NULL DEFAULT 'COMPUTED',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_amount_non_negative CHECK (amount_minor >= 0),
  CONSTRAINT price_compare_at_greater CHECK (compare_at_amount_minor IS NULL OR compare_at_amount_minor > amount_minor),
  CONSTRAINT price_validity_order CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS idx_price_variant_list_valid ON price(variant_id, list_id, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS price_variant_active_idx ON price(variant_id, list_id, currency) WHERE valid_to IS NULL;

CREATE TABLE IF NOT EXISTS discount (
  id uuid PRIMARY KEY,
  code text,
  kind pricing_value_kind NOT NULL,
  value integer NOT NULL,
  scope pricing_scope NOT NULL,
  scope_id uuid,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT discount_value_non_negative CHECK (value >= 0),
  CONSTRAINT discount_use_count_valid CHECK (max_uses IS NULL OR (max_uses >= 0 AND used_count <= max_uses)),
  CONSTRAINT discount_validity_order CHECK (valid_to IS NULL OR valid_to > valid_from),
  CONSTRAINT discount_scope_id_required CHECK ((scope = 'global' AND scope_id IS NULL) OR (scope <> 'global' AND scope_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_code_unique ON discount(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discount_active_valid ON discount(is_active, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS discount_scope_idx ON discount(scope, scope_id);

CREATE TABLE IF NOT EXISTS stock_item (
  id uuid PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  on_hand integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  reorder_point integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_item_non_negative CHECK (on_hand >= 0 AND reserved >= 0),
  CONSTRAINT stock_item_reserved_le_on_hand CHECK (reserved <= on_hand),
  CONSTRAINT stock_item_reorder_point_non_negative CHECK (reorder_point IS NULL OR reorder_point >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_item_variant_unique ON stock_item(variant_id);
CREATE INDEX IF NOT EXISTS stock_item_variant_idx ON stock_item(variant_id);

CREATE TABLE IF NOT EXISTS stock_reservation (
  id uuid PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  order_id uuid,
  quantity integer NOT NULL,
  status reservation_status NOT NULL DEFAULT 'ACTIVE',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_reservation_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS stock_reservation_variant_status_idx ON stock_reservation(variant_id, status);
CREATE INDEX IF NOT EXISTS stock_reservation_active_expiry_idx ON stock_reservation(status, expires_at);
CREATE INDEX IF NOT EXISTS stock_reservation_order_idx ON stock_reservation(order_id);

CREATE TABLE IF NOT EXISTS stock_movement (
  id uuid PRIMARY KEY,
  variant_id uuid NOT NULL REFERENCES product_variant(id) ON DELETE CASCADE,
  type stock_movement_type NOT NULL,
  quantity integer NOT NULL,
  reason text,
  ref_type text,
  ref_id text,
  created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movement_quantity_not_zero CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS stock_movement_variant_created_idx ON stock_movement(variant_id, created_at);
CREATE INDEX IF NOT EXISTS stock_movement_ref_idx ON stock_movement(ref_type, ref_id);
