import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { adminUser } from "./identity.js";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id").references(() => adminUser.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull().default("admin"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorCreatedIdx: index("audit_log_actor_created_idx").on(table.actorId, table.createdAt),
    resourceIdx: index("audit_log_resource_idx").on(table.resourceType, table.resourceId),
    actionCreatedIdx: index("audit_log_action_created_idx").on(table.action, table.createdAt),
  }),
);
