CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE media_source AS ENUM ('upload', 'ai', 'import');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE outbox_status AS ENUM ('pending', 'processing', 'processed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS media_asset (
  id uuid PRIMARY KEY,
  storage_key text NOT NULL,
  mime text NOT NULL,
  byte_size integer NOT NULL,
  width integer,
  height integer,
  dominant_color text,
  blur_placeholder text,
  alt_text text,
  source media_source NOT NULL DEFAULT 'upload',
  checksum text NOT NULL,
  created_by uuid REFERENCES admin_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_asset_byte_size_positive CHECK (byte_size > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS media_asset_storage_key_unique ON media_asset(storage_key);
CREATE UNIQUE INDEX IF NOT EXISTS media_asset_checksum_unique ON media_asset(checksum);
CREATE INDEX IF NOT EXISTS media_asset_created_by_idx ON media_asset(created_by, created_at);

CREATE TABLE IF NOT EXISTS category (
  id uuid PRIMARY KEY,
  parent_id uuid REFERENCES category(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  image_id uuid REFERENCES media_asset(id) ON DELETE SET NULL,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS category_root_slug_unique ON category(slug) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS category_parent_slug_unique ON category(parent_id, slug) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_parent_pos ON category(parent_id, position);

CREATE TABLE IF NOT EXISTS brand (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  logo_id uuid REFERENCES media_asset(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_slug_unique ON brand(slug);

CREATE TABLE IF NOT EXISTS product (
  id uuid PRIMARY KEY,
  slug text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text NOT NULL,
  brand_id uuid REFERENCES brand(id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES category(id) ON DELETE RESTRICT,
  status product_status NOT NULL DEFAULT 'DRAFT',
  main_image_id uuid REFERENCES media_asset(id) ON DELETE SET NULL,
  sku text,
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON product(slug);
CREATE UNIQUE INDEX IF NOT EXISTS product_sku_unique ON product(sku);
CREATE INDEX IF NOT EXISTS idx_products_status_category ON product(status, category_id);
CREATE INDEX IF NOT EXISTS product_category_idx ON product(category_id);
CREATE INDEX IF NOT EXISTS product_brand_idx ON product(brand_id);
CREATE INDEX IF NOT EXISTS idx_product_title_trgm ON product USING gin (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS product_media (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES media_asset(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  alt_text text,
  CONSTRAINT product_media_position_range CHECK (position >= 0 AND position <= 5)
);

CREATE INDEX IF NOT EXISTS idx_product_media_product_pos ON product_media(product_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS product_media_product_position_unique ON product_media(product_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS product_media_product_asset_unique ON product_media(product_id, media_asset_id);

CREATE TABLE IF NOT EXISTS product_variant (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  sku text NOT NULL,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variants_product_active ON product_variant(product_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS product_variant_sku_unique ON product_variant(sku);

CREATE TABLE IF NOT EXISTS spec_group (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS spec_group_product_position_idx ON spec_group(product_id, position);

CREATE TABLE IF NOT EXISTS spec_item (
  id uuid PRIMARY KEY,
  spec_group_id uuid NOT NULL REFERENCES spec_group(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  value_text text,
  value_num numeric,
  unit text,
  position integer NOT NULL DEFAULT 0,
  CONSTRAINT spec_item_has_value CHECK (value_text IS NOT NULL OR value_num IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS spec_item_group_position_idx ON spec_item(spec_group_id, position);

CREATE TABLE IF NOT EXISTS product_slug_history (
  id uuid PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  old_slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_slug_history_old_slug_unique ON product_slug_history(old_slug);
CREATE INDEX IF NOT EXISTS product_slug_history_product_idx ON product_slug_history(product_id);

CREATE TABLE IF NOT EXISTS outbox_event (
  id uuid PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status outbox_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbox_event_pending_idx ON outbox_event(status, available_at);
CREATE INDEX IF NOT EXISTS outbox_event_aggregate_idx ON outbox_event(aggregate_type, aggregate_id);
