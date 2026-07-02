import {
  CustomerConsentKind,
  CustomerContactChannel,
  CustomerContactDirection,
  CustomerTier,
} from "@cloudcommerce/types";
import { relations, sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { adminUser } from "./identity.js";

export const customerTierEnum = pgEnum("customer_tier", [
  CustomerTier.CloudBase,
  CustomerTier.CloudPlus,
  CustomerTier.CloudPrime,
]);

export const customerConsentKindEnum = pgEnum("customer_consent_kind", [
  CustomerConsentKind.MARKETING_WHATSAPP,
  CustomerConsentKind.MARKETING_EMAIL,
  CustomerConsentKind.DATA_PROCESSING,
]);

export const customerContactChannelEnum = pgEnum("customer_contact_channel", [
  CustomerContactChannel.CALL,
  CustomerContactChannel.WHATSAPP,
  CustomerContactChannel.EMAIL,
  CustomerContactChannel.OTHER,
]);

export const customerContactDirectionEnum = pgEnum("customer_contact_direction", [
  CustomerContactDirection.IN,
  CustomerContactDirection.OUT,
]);

export const customer = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    // Maintained by application code as `${firstName} ${lastName}` to keep Drizzle inserts explicit.
    displayName: text("display_name").notNull(),
    email: text("email"),
    whatsapp: text("whatsapp"),
    notes: text("notes"),
    tier: customerTierEnum("tier").notNull().default(CustomerTier.CloudBase),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    emailUnique: uniqueIndex("uq_customer_email")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} IS NOT NULL AND ${table.deletedAt} IS NULL`),
    whatsappIdx: index("idx_customers_whatsapp").on(table.whatsapp),
    createdIdx: index("idx_customers_created").on(table.createdAt, table.id),
  }),
);

export const customerAddress = pgTable(
  "customer_address",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    label: text("label"),
    recipientName: text("recipient_name"),
    province: text("province").notNull(),
    city: text("city").notNull(),
    street: text("street").notNull(),
    streetNumber: text("street_number"),
    betweenStreets: text("between_streets"),
    postalCode: text("postal_code"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerIdx: index("idx_customer_address_customer").on(table.customerId),
    primaryUnique: uniqueIndex("uq_customer_primary_address")
      .on(table.customerId)
      .where(sql`${table.isPrimary} = true`),
  }),
);

export const customerConsent = pgTable(
  "customer_consent",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    kind: customerConsentKindEnum("kind").notNull(),
    granted: boolean("granted").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull(),
  },
  (table) => ({
    customerKindIdx: index("idx_customer_consent_customer_kind").on(table.customerId, table.kind),
  }),
);

export const customerContactLog = pgTable(
  "customer_contact_log",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    channel: customerContactChannelEnum("channel").notNull(),
    direction: customerContactDirectionEnum("direction").notNull().default(CustomerContactDirection.IN),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => adminUser.id, { onDelete: "set null" }),
  },
  (table) => ({
    customerOccurredIdx: index("idx_contactlog_customer_occurred").on(table.customerId, table.occurredAt),
    callsIdx: index("idx_contactlog_calls").on(table.customerId, table.occurredAt).where(sql`${table.channel} = 'call'`),
  }),
);

export const customerRelations = relations(customer, ({ many }) => ({
  addresses: many(customerAddress),
  consents: many(customerConsent),
  contacts: many(customerContactLog),
}));

export const customerAddressRelations = relations(customerAddress, ({ one }) => ({
  customer: one(customer, {
    fields: [customerAddress.customerId],
    references: [customer.id],
  }),
}));

export const customerConsentRelations = relations(customerConsent, ({ one }) => ({
  customer: one(customer, {
    fields: [customerConsent.customerId],
    references: [customer.id],
  }),
}));

export const customerContactLogRelations = relations(customerContactLog, ({ one }) => ({
  customer: one(customer, {
    fields: [customerContactLog.customerId],
    references: [customer.id],
  }),
  createdByAdmin: one(adminUser, {
    fields: [customerContactLog.createdBy],
    references: [adminUser.id],
  }),
}));
