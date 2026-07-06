-- 0016: Modo reventa (dropshipping).
-- Precio mayorista por cantidad (config global), rebate por proveedor para
-- liquidaciones, y proveedor congelado por línea de orden.

CREATE TABLE IF NOT EXISTS "resale_config" (
  "id" text PRIMARY KEY,
  "wholesale_enabled" boolean NOT NULL DEFAULT false,
  "wholesale_min_qty" integer NOT NULL DEFAULT 4 CHECK ("wholesale_min_qty" >= 2),
  "wholesale_margin_bps" integer NOT NULL DEFAULT 0 CHECK ("wholesale_margin_bps" >= 0),
  "allow_backorder" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "resale_config" ("id", "wholesale_enabled", "wholesale_min_qty", "wholesale_margin_bps", "allow_backorder")
VALUES ('default', false, 4, 0, false)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "supplier_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_line_supplier_idx" ON "order_line" ("supplier_id");
--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN IF NOT EXISTS "rebate_bps" integer NOT NULL DEFAULT 300;
