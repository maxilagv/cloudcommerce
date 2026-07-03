import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const outboxStatusEnum = pgEnum("outbox_status", ["pending", "processing", "processed", "failed"]);

export const outboxEvent = pgTable(
  "outbox_event",
  {
    id: uuid("id").primaryKey(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pendingIdx: index("outbox_event_pending_idx").on(table.status, table.availableAt),
    processingLockedIdx: index("outbox_event_processing_locked_idx").on(table.status, table.lockedAt),
    aggregateIdx: index("outbox_event_aggregate_idx").on(table.aggregateType, table.aggregateId),
  }),
);
