import type { SupplierContact } from "@cloudcommerce/types";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { productVariant } from "./catalog.js";
import { order } from "./orders.js";

export const supplierFeedKindEnum = pgEnum("supplier_feed_kind", ["csv", "api"]);

export const supplierFeedStatusEnum = pgEnum("supplier_feed_status", ["IDLE", "RUNNING", "OK", "PARTIAL", "FAILED", "DISABLED"]);

export const supplierSyncStatusEnum = pgEnum("supplier_sync_status", ["LINKED", "PENDING_REVIEW", "CONFLICT", "DISCONTINUED"]);

export const supplierForwardStatusEnum = pgEnum("supplier_forward_status", ["PENDING", "SENT", "ACCEPTED", "REJECTED", "FAILED"]);

export const supplier = pgTable(
  "supplier",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    contact: jsonb("contact").$type<SupplierContact>(),
    apiConfigEnc: text("api_config_enc"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("supplier_slug_unique").on(table.slug),
    activeIdx: index("supplier_active_idx").on(table.isActive),
  }),
);

export const supplierFeed = pgTable(
  "supplier_feed",
  {
    id: uuid("id").primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }),
    kind: supplierFeedKindEnum("kind").notNull(),
    sourceUrl: text("source_url"),
    schedule: text("schedule"),
    fieldMap: jsonb("field_map").$type<Record<string, string>>(),
    status: supplierFeedStatusEnum("status").notNull().default("IDLE"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunSummary: jsonb("last_run_summary").$type<Record<string, number>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    supplierIdx: index("supplier_feed_supplier_idx").on(table.supplierId),
  }),
);

export const supplierProductMap = pgTable(
  "supplier_product_map",
  {
    id: uuid("id").primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "set null" }),
    raw: jsonb("raw").$type<Record<string, unknown>>().notNull(),
    contentHash: text("content_hash"),
    syncStatus: supplierSyncStatusEnum("sync_status").notNull().default("PENDING_REVIEW"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    supplierExternalUnique: uniqueIndex("supplier_product_map_supplier_external_unique").on(table.supplierId, table.externalId),
    variantIdx: index("supplier_product_map_variant_idx").on(table.variantId),
    statusIdx: index("supplier_product_map_status_idx").on(table.supplierId, table.syncStatus),
  }),
);

export const supplierOrderRef = pgTable(
  "supplier_order_ref",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    externalOrderId: text("external_order_id"),
    status: supplierForwardStatusEnum("status").notNull().default("PENDING"),
    idempotencyKey: text("idempotency_key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderSupplierUnique: uniqueIndex("supplier_order_ref_order_supplier_unique").on(table.orderId, table.supplierId),
    idempotencyUnique: uniqueIndex("supplier_order_ref_idempotency_unique").on(table.idempotencyKey),
    externalOrderIdx: index("supplier_order_ref_external_idx").on(table.supplierId, table.externalOrderId),
    statusIdx: index("supplier_order_ref_status_idx").on(table.status),
  }),
);

export const supplierWebhookEvent = pgTable(
  "supplier_webhook_event",
  {
    id: uuid("id").primaryKey(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    supplierEventUnique: uniqueIndex("supplier_webhook_event_unique").on(table.supplierId, table.eventId),
  }),
);
