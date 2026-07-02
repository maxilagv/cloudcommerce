import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { adminUser } from "./identity.js";

export const aiGenerationKindEnum = pgEnum("ai_generation_kind", [
  "DESCRIPTION",
  "SPECS",
  "SEO",
  "IMAGE",
  "RECOMMENDATION",
  "TRENDS",
  "PRICING",
]);

export const aiGenerationStatusEnum = pgEnum("ai_generation_status", [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "PARTIAL",
  "DEGRADED",
]);

export const aiTargetTypeEnum = pgEnum("ai_target_type", ["PRODUCT", "VARIANT", "CATEGORY", "SUPPLIER_FEED", "NONE"]);

export const aiAlertKindEnum = pgEnum("ai_alert_kind", ["PRICE", "STOCK", "TREND"]);

export const aiAlertStatusEnum = pgEnum("ai_alert_status", ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"]);

export const aiGeneration = pgTable(
  "ai_generation",
  {
    id: uuid("id").primaryKey(),
    kind: aiGenerationKindEnum("kind").notNull(),
    targetType: aiTargetTypeEnum("target_type").notNull().default("NONE"),
    targetId: uuid("target_id"),
    promptRef: text("prompt_ref").notNull(),
    status: aiGenerationStatusEnum("status").notNull().default("QUEUED"),
    costEstimateMinor: integer("cost_estimate_minor"),
    currency: text("currency").notNull().default("ARS"),
    errorCode: text("error_code"),
    actorId: uuid("actor_id").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    actorCreatedIdx: index("ai_generation_actor_created_idx").on(table.actorId, table.createdAt),
    targetIdx: index("ai_generation_target_idx").on(table.targetType, table.targetId),
    kindStatusIdx: index("ai_generation_kind_status_idx").on(table.kind, table.status),
    createdIdx: index("ai_generation_created_idx").on(table.createdAt),
  }),
);

export const aiAlert = pgTable(
  "ai_alert",
  {
    id: uuid("id").primaryKey(),
    kind: aiAlertKindEnum("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    dedupeKey: text("dedupe_key"),
    status: aiAlertStatusEnum("status").notNull().default("OPEN"),
    resolutionNote: text("resolution_note"),
    resolvedBy: uuid("resolved_by").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    statusCreatedIdx: index("ai_alert_status_created_idx").on(table.status, table.createdAt),
    kindIdx: index("ai_alert_kind_idx").on(table.kind),
    dedupeIdx: index("ai_alert_dedupe_idx").on(table.dedupeKey, table.status),
  }),
);
