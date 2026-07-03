ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;

ALTER TABLE "order"
  ADD CONSTRAINT "order_version_positive" CHECK ("version" >= 1);

ALTER TABLE "stock_reservation"
  ADD CONSTRAINT "stock_reservation_order_id_order_id_fk"
  FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE restrict;

ALTER TABLE "outbox_event"
  ADD COLUMN IF NOT EXISTS "locked_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "outbox_event_processing_locked_idx"
  ON "outbox_event" ("status", "locked_at");

CREATE UNIQUE INDEX IF NOT EXISTS "supplier_cost_one_open_per_variant_unique"
  ON "supplier_cost" ("variant_id")
  WHERE "valid_to" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "price_one_open_per_variant_list_unique"
  ON "price" ("variant_id", "list_id")
  WHERE "valid_to" IS NULL;
