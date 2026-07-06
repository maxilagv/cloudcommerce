import { relations, sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { customer } from "./customers.js";

/**
 * Cuentas de cliente del storefront público. Separadas de admin_user: un
 * cliente inicia sesión en la tienda con email/contraseña y su sesión vive en
 * una cookie propia (cc_customer_session). La cuenta referencia el registro
 * CRM `customer` (1 a 1).
 */

export const customerAccount = pgTable(
  "customer_account",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerUnique: uniqueIndex("customer_account_customer_uq").on(table.customerId),
    emailUnique: uniqueIndex("customer_account_email_uq").on(sql`lower(${table.email})`),
  }),
);

export const customerSession = pgTable(
  "customer_session",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => customerAccount.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    ip: text("ip").notNull(),
    userAgent: text("user_agent").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUnique: uniqueIndex("customer_session_token_hash_uq").on(table.sessionTokenHash),
    accountIdx: index("customer_session_account_idx").on(table.accountId),
    expiresIdx: index("customer_session_expires_idx").on(table.expiresAt),
  }),
);

export const customerAccountRelations = relations(customerAccount, ({ one, many }) => ({
  customer: one(customer, {
    fields: [customerAccount.customerId],
    references: [customer.id],
  }),
  sessions: many(customerSession),
}));

export const customerSessionRelations = relations(customerSession, ({ one }) => ({
  account: one(customerAccount, {
    fields: [customerSession.accountId],
    references: [customerAccount.id],
  }),
}));
