import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { adminUser } from "./identity.js";
import { customer } from "./customers.js";

/**
 * Seguimiento inteligente de clientes: perfil aprendido por IA + conversaciones
 * WhatsApp bidireccionales operadas por el vendedor IA.
 */

export const aiConversationStatusEnum = pgEnum("ai_conversation_status", ["ACTIVE", "PAUSED", "CLOSED"]);

export const aiMessageDirectionEnum = pgEnum("ai_message_direction", ["IN", "OUT"]);

export const aiMessageStatusEnum = pgEnum("ai_message_status", [
  "PENDING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "RECEIVED",
]);

export const aiMessageAuthorEnum = pgEnum("ai_message_author", ["CUSTOMER", "AI", "ADMIN"]);

export const customerAiProfile = pgTable(
  "customer_ai_profile",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    interests: jsonb("interests").$type<string[]>().notNull().default([]),
    segments: jsonb("segments").$type<string[]>().notNull().default([]),
    priceSensitivity: text("price_sensitivity").notNull().default("medium"),
    buyingPatterns: jsonb("buying_patterns").$type<string[]>().notNull().default([]),
    recommendedCategories: jsonb("recommended_categories").$type<string[]>().notNull().default([]),
    nextBestActions: jsonb("next_best_actions").$type<string[]>().notNull().default([]),
    summary: text("summary").notNull().default(""),
    confidence: integer("confidence").notNull().default(0),
    model: text("model").notNull().default(""),
    lastAnalyzedAt: timestamp("last_analyzed_at", { withTimezone: true }),
    /** Última compra vista por el analizador; permite detectar actividad nueva. */
    lastOrderSeenAt: timestamp("last_order_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerUq: uniqueIndex("customer_ai_profile_customer_uq").on(table.customerId),
    analyzedIdx: index("customer_ai_profile_analyzed_idx").on(table.lastAnalyzedAt),
  }),
);

export const aiConversation = pgTable(
  "ai_conversation",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("whatsapp"),
    status: aiConversationStatusEnum("status").notNull().default("ACTIVE"),
    /** true = la IA responde y hace outreach sola; false = solo el admin escribe. */
    autopilot: boolean("autopilot").notNull().default(true),
    needsHuman: boolean("needs_human").notNull().default(false),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastOutreachAt: timestamp("last_outreach_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerChannelUq: uniqueIndex("ai_conversation_customer_channel_uq").on(table.customerId, table.channel),
    lastMessageIdx: index("ai_conversation_last_message_idx").on(table.lastMessageAt),
    needsHumanIdx: index("ai_conversation_needs_human_idx").on(table.needsHuman, table.status),
  }),
);

export const aiMessage = pgTable(
  "ai_message",
  {
    id: uuid("id").primaryKey(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    direction: aiMessageDirectionEnum("direction").notNull(),
    author: aiMessageAuthorEnum("author").notNull(),
    content: text("content").notNull(),
    status: aiMessageStatusEnum("status").notNull().default("PENDING"),
    intent: text("intent"),
    goal: text("goal"),
    recommendedProductIds: jsonb("recommended_product_ids").$type<string[]>().notNull().default([]),
    waMessageId: text("wa_message_id"),
    errorMessage: text("error_message"),
    sentBy: uuid("sent_by").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => ({
    conversationCreatedIdx: index("ai_message_conversation_created_idx").on(table.conversationId, table.createdAt),
    statusIdx: index("ai_message_status_idx").on(table.status, table.direction),
    waMessageIdx: index("ai_message_wa_id_idx").on(table.waMessageId),
  }),
);
