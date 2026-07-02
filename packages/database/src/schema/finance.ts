import { DocumentStatus, DocumentType } from "@cloudcommerce/types";
import { relations, sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { customer } from "./customers.js";
import { adminUser } from "./identity.js";
import { order } from "./orders.js";

export const documentTypeEnum = pgEnum("document_type", [
  DocumentType.REMITO,
  DocumentType.FACTURA,
  DocumentType.NOTA_CREDITO,
]);

export const documentStatusEnum = pgEnum("document_status", [
  DocumentStatus.PROCESSING,
  DocumentStatus.AVAILABLE,
]);

export const documentSequence = pgTable(
  "document_sequence",
  {
    id: uuid("id").primaryKey(),
    type: documentTypeEnum("type").notNull(),
    series: text("series").notNull(),
    nextNumber: bigint("next_number", { mode: "number" }).notNull().default(1),
  },
  (table) => ({
    typeSeriesUnique: uniqueIndex("document_sequence_type_series_unique").on(table.type, table.series),
    nextNumberPositive: check("document_sequence_next_number_positive", sql`${table.nextNumber} >= 1`),
  }),
);

export const commercialDocument = pgTable(
  "commercial_document",
  {
    id: uuid("id").primaryKey(),
    type: documentTypeEnum("type").notNull(),
    series: text("series").notNull().default("A"),
    number: bigint("number", { mode: "number" }).notNull(),
    displayNumber: text("display_number").notNull(),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id").references(() => customer.id, { onDelete: "restrict" }),
    status: documentStatusEnum("status").notNull().default(DocumentStatus.PROCESSING),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    totalMinor: integer("total_minor").notNull(),
    currency: text("currency").notNull().default("ARS"),
    pdfStorageKey: text("pdf_storage_key"),
    pdfChecksum: text("pdf_checksum"),
    contentHash: text("content_hash").notNull(),
    relatedDocumentId: uuid("related_document_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => adminUser.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    typeSeriesNumberUnique: uniqueIndex("commercial_document_type_series_number_unique").on(table.type, table.series, table.number),
    typeSeriesDisplayUnique: uniqueIndex("commercial_document_type_series_display_unique").on(
      table.type,
      table.series,
      table.displayNumber,
    ),
    oneAvailablePerOrderType: uniqueIndex("commercial_document_available_order_type_unique")
      .on(table.type, table.orderId)
      .where(sql`${table.status} = 'AVAILABLE' AND ${table.orderId} IS NOT NULL`),
    orderIdx: index("commercial_document_order_idx").on(table.orderId),
    customerIdx: index("commercial_document_customer_idx").on(table.customerId),
    createdIdx: index("commercial_document_created_idx").on(table.createdAt),
    totalNonNegative: check("commercial_document_total_non_negative", sql`${table.totalMinor} >= 0`),
    availableHasFile: check(
      "commercial_document_available_has_file",
      sql`${table.status} <> 'AVAILABLE' OR (${table.issuedAt} IS NOT NULL AND ${table.pdfStorageKey} IS NOT NULL AND ${table.pdfChecksum} IS NOT NULL)`,
    ),
  }),
);

export const documentDownload = pgTable(
  "document_download",
  {
    id: uuid("id").primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => commercialDocument.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => adminUser.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull().default("admin"),
    reason: text("reason"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentCreatedIdx: index("document_download_document_created_idx").on(table.documentId, table.createdAt),
    actorCreatedIdx: index("document_download_actor_created_idx").on(table.actorId, table.createdAt),
  }),
);

export const financePeriodSnapshot = pgTable(
  "finance_period_snapshot",
  {
    id: uuid("id").primaryKey(),
    period: text("period").notNull(),
    currency: text("currency").notNull().default("ARS"),
    revenueMinor: integer("revenue_minor").notNull().default(0),
    costMinor: integer("cost_minor").notNull().default(0),
    marginMinor: integer("margin_minor").notNull().default(0),
    ordersCount: integer("orders_count").notNull().default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    sourceVersion: text("source_version").notNull().default("orders.v1"),
    isStale: boolean("is_stale").notNull().default(false),
  },
  (table) => ({
    periodCurrencyUnique: uniqueIndex("finance_period_snapshot_period_currency_unique").on(table.period, table.currency),
    periodIdx: index("finance_period_snapshot_period_idx").on(table.period),
    amountsValid: check(
      "finance_period_snapshot_amounts_valid",
      sql`${table.revenueMinor} >= 0 AND ${table.costMinor} >= 0 AND ${table.marginMinor} = ${table.revenueMinor} - ${table.costMinor}`,
    ),
    ordersNonNegative: check("finance_period_snapshot_orders_non_negative", sql`${table.ordersCount} >= 0`),
  }),
);

export const commercialDocumentRelations = relations(commercialDocument, ({ one, many }) => ({
  order: one(order, {
    fields: [commercialDocument.orderId],
    references: [order.id],
  }),
  customer: one(customer, {
    fields: [commercialDocument.customerId],
    references: [customer.id],
  }),
  creator: one(adminUser, {
    fields: [commercialDocument.createdBy],
    references: [adminUser.id],
  }),
  downloads: many(documentDownload),
}));

export const documentDownloadRelations = relations(documentDownload, ({ one }) => ({
  document: one(commercialDocument, {
    fields: [documentDownload.documentId],
    references: [commercialDocument.id],
  }),
  actor: one(adminUser, {
    fields: [documentDownload.actorId],
    references: [adminUser.id],
  }),
}));
