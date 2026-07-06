-- 0015: CloudPoints (loyalty) + CloudDigital.
-- Ledger inmutable de puntos con saldo cacheado, recompensas con ventana de
-- rotación semanal y stock, canjes con código único, membresías CloudDigital.

CREATE TYPE "loyalty_transaction_type" AS ENUM ('EARN', 'REDEEM', 'REVERSAL', 'ADJUST');
--> statement-breakpoint
CREATE TYPE "loyalty_reward_kind" AS ENUM ('PHYSICAL', 'DIGITAL');
--> statement-breakpoint
CREATE TYPE "loyalty_redemption_status" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');
--> statement-breakpoint
CREATE TYPE "clouddigital_status" AS ENUM ('WAITLIST', 'ACTIVE', 'REVOKED');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_account" (
  "id" uuid PRIMARY KEY,
  "customer_id" uuid NOT NULL REFERENCES "customer"("id") ON DELETE CASCADE,
  "balance" integer NOT NULL DEFAULT 0,
  "lifetime_earned" integer NOT NULL DEFAULT 0 CHECK ("lifetime_earned" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_account_customer_uq" ON "loyalty_account" ("customer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_transaction" (
  "id" uuid PRIMARY KEY,
  "account_id" uuid NOT NULL REFERENCES "loyalty_account"("id") ON DELETE CASCADE,
  "type" "loyalty_transaction_type" NOT NULL,
  "points" integer NOT NULL CHECK ("points" <> 0),
  "order_id" uuid REFERENCES "order"("id") ON DELETE SET NULL,
  "redemption_id" uuid,
  "reason" text NOT NULL,
  "idempotency_key" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_transaction_idem_uq" ON "loyalty_transaction" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_transaction_account_idx" ON "loyalty_transaction" ("account_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_transaction_order_idx" ON "loyalty_transaction" ("order_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_reward" (
  "id" uuid PRIMARY KEY,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "kind" "loyalty_reward_kind" NOT NULL,
  "points_cost" integer NOT NULL CHECK ("points_cost" > 0),
  "stock" integer CHECK ("stock" IS NULL OR "stock" >= 0),
  "image_id" uuid REFERENCES "media_asset"("id") ON DELETE SET NULL,
  "available_from" timestamptz,
  "available_until" timestamptz,
  "is_active" boolean NOT NULL DEFAULT true,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_reward_active_idx" ON "loyalty_reward" ("is_active", "available_until");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_redemption" (
  "id" uuid PRIMARY KEY,
  "account_id" uuid NOT NULL REFERENCES "loyalty_account"("id") ON DELETE CASCADE,
  "reward_id" uuid NOT NULL REFERENCES "loyalty_reward"("id") ON DELETE RESTRICT,
  "reward_title" text NOT NULL,
  "points_spent" integer NOT NULL CHECK ("points_spent" > 0),
  "status" "loyalty_redemption_status" NOT NULL DEFAULT 'PENDING',
  "code" text NOT NULL,
  "note" text,
  "idempotency_key" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "fulfilled_at" timestamptz,
  "cancelled_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_redemption_code_uq" ON "loyalty_redemption" ("code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_redemption_idem_uq" ON "loyalty_redemption" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_redemption_account_idx" ON "loyalty_redemption" ("account_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loyalty_redemption_status_idx" ON "loyalty_redemption" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loyalty_program_config" (
  "id" text PRIMARY KEY,
  "points_per_1000" integer NOT NULL DEFAULT 1 CHECK ("points_per_1000" >= 0),
  "is_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "loyalty_program_config" ("id", "points_per_1000", "is_enabled")
VALUES ('default', 1, true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clouddigital_membership" (
  "id" uuid PRIMARY KEY,
  "customer_id" uuid NOT NULL REFERENCES "customer"("id") ON DELETE CASCADE,
  "status" "clouddigital_status" NOT NULL DEFAULT 'WAITLIST',
  "joined_at" timestamptz NOT NULL DEFAULT now(),
  "activated_at" timestamptz,
  "revoked_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clouddigital_membership_customer_uq" ON "clouddigital_membership" ("customer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clouddigital_membership_status_idx" ON "clouddigital_membership" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clouddigital_benefit" (
  "id" uuid PRIMARY KEY,
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "partner" text NOT NULL DEFAULT 'LayerCloud',
  "discount_label" text NOT NULL,
  "code" text,
  "url" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
