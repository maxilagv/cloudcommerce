import { boolean, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { adminUser } from "./identity.js";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const setting = pgTable(
  "setting",
  {
    id: uuid("id").primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value").$type<JsonValue>().notNull(),
    scope: text("scope").notNull().default("business"),
    updatedBy: uuid("updated_by").references(() => adminUser.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyUnique: uniqueIndex("setting_key_unique").on(table.key),
    scopeIdx: index("setting_scope_idx").on(table.scope),
    updatedByIdx: index("setting_updated_by_idx").on(table.updatedBy, table.updatedAt),
  }),
);

export const featureFlag = pgTable(
  "feature_flag",
  {
    id: uuid("id").primaryKey(),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    owner: text("owner").notNull(),
    reviewAt: date("review_at").notNull(),
    removalPlan: text("removal_plan"),
    description: text("description").notNull(),
    updatedBy: uuid("updated_by").references(() => adminUser.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyUnique: uniqueIndex("feature_flag_key_unique").on(table.key),
    enabledIdx: index("feature_flag_enabled_idx").on(table.enabled),
    ownerIdx: index("feature_flag_owner_idx").on(table.owner),
    reviewAtIdx: index("feature_flag_review_at_idx").on(table.reviewAt),
  }),
);
