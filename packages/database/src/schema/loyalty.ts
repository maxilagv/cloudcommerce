import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  CloudDigitalStatus,
  LoyaltyRedemptionStatus,
  LoyaltyRewardKind,
  LoyaltyTransactionType,
} from "@cloudcommerce/types";
import { mediaAsset } from "./catalog.js";
import { customer } from "./customers.js";
import { order } from "./orders.js";

/**
 * CloudPoints (loyalty) + CloudDigital.
 *
 * Modelo contable: `loyalty_transaction` es un ledger inmutable de deltas
 * firmados; `loyalty_account.balance` es un cache que SIEMPRE se actualiza en
 * la misma transacción que inserta el asiento. El saldo puede quedar negativo
 * solo por reversas (orden cancelada después de gastar los puntos) — el
 * servicio prohíbe canjear sin saldo, nunca la base.
 */

export const loyaltyTransactionTypeEnum = pgEnum("loyalty_transaction_type", [
  LoyaltyTransactionType.EARN,
  LoyaltyTransactionType.REDEEM,
  LoyaltyTransactionType.REVERSAL,
  LoyaltyTransactionType.ADJUST,
]);

export const loyaltyRewardKindEnum = pgEnum("loyalty_reward_kind", [
  LoyaltyRewardKind.PHYSICAL,
  LoyaltyRewardKind.DIGITAL,
]);

export const loyaltyRedemptionStatusEnum = pgEnum("loyalty_redemption_status", [
  LoyaltyRedemptionStatus.PENDING,
  LoyaltyRedemptionStatus.FULFILLED,
  LoyaltyRedemptionStatus.CANCELLED,
]);

export const cloudDigitalStatusEnum = pgEnum("clouddigital_status", [
  CloudDigitalStatus.WAITLIST,
  CloudDigitalStatus.ACTIVE,
  CloudDigitalStatus.REVOKED,
]);

export const loyaltyAccount = pgTable(
  "loyalty_account",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    lifetimeEarned: integer("lifetime_earned").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerUnique: uniqueIndex("loyalty_account_customer_uq").on(table.customerId),
  }),
);

export const loyaltyTransaction = pgTable(
  "loyalty_transaction",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccount.id, { onDelete: "cascade" }),
    type: loyaltyTransactionTypeEnum("type").notNull(),
    /** Delta firmado en puntos (positivo acredita, negativo debita). */
    points: integer("points").notNull(),
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    redemptionId: uuid("redemption_id"),
    reason: text("reason").notNull(),
    /** Clave de idempotencia (p.ej. `earn:order:{id}`) — evita dobles asientos. */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idempotencyUnique: uniqueIndex("loyalty_transaction_idem_uq").on(table.idempotencyKey),
    accountIdx: index("loyalty_transaction_account_idx").on(table.accountId, table.createdAt),
    orderIdx: index("loyalty_transaction_order_idx").on(table.orderId),
  }),
);

export const loyaltyReward = pgTable(
  "loyalty_reward",
  {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    kind: loyaltyRewardKindEnum("kind").notNull(),
    pointsCost: integer("points_cost").notNull(),
    /** null = stock ilimitado. */
    stock: integer("stock"),
    imageId: uuid("image_id").references(() => mediaAsset.id, { onDelete: "set null" }),
    /** Ventana de vigencia — habilita la rotación semanal de regalos. */
    availableFrom: timestamp("available_from", { withTimezone: true }),
    availableUntil: timestamp("available_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index("loyalty_reward_active_idx").on(table.isActive, table.availableUntil),
  }),
);

export const loyaltyRedemption = pgTable(
  "loyalty_redemption",
  {
    id: uuid("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccount.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => loyaltyReward.id, { onDelete: "restrict" }),
    /** Snapshot del título al momento del canje (el reward puede editarse). */
    rewardTitle: text("reward_title").notNull(),
    pointsSpent: integer("points_spent").notNull(),
    status: loyaltyRedemptionStatusEnum("status")
      .notNull()
      .default(LoyaltyRedemptionStatus.PENDING),
    code: text("code").notNull(),
    note: text("note"),
    /** Clave de idempotencia del canje (reintentos del cliente). */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => ({
    codeUnique: uniqueIndex("loyalty_redemption_code_uq").on(table.code),
    idempotencyUnique: uniqueIndex("loyalty_redemption_idem_uq").on(table.idempotencyKey),
    accountIdx: index("loyalty_redemption_account_idx").on(table.accountId, table.createdAt),
    statusIdx: index("loyalty_redemption_status_idx").on(table.status),
  }),
);

/** Config del programa — una sola fila (id fijo "default"). */
export const loyaltyProgramConfig = pgTable("loyalty_program_config", {
  id: text("id").primaryKey(),
  pointsPer1000: integer("points_per_1000").notNull().default(1),
  isEnabled: boolean("is_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cloudDigitalMembership = pgTable(
  "clouddigital_membership",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    status: cloudDigitalStatusEnum("status").notNull().default(CloudDigitalStatus.WAITLIST),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerUnique: uniqueIndex("clouddigital_membership_customer_uq").on(table.customerId),
    statusIdx: index("clouddigital_membership_status_idx").on(table.status),
  }),
);

export const cloudDigitalBenefit = pgTable("clouddigital_benefit", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  partner: text("partner").notNull().default("LayerCloud"),
  discountLabel: text("discount_label").notNull(),
  code: text("code"),
  url: text("url"),
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loyaltyAccountRelations = relations(loyaltyAccount, ({ one, many }) => ({
  customer: one(customer, {
    fields: [loyaltyAccount.customerId],
    references: [customer.id],
  }),
  transactions: many(loyaltyTransaction),
  redemptions: many(loyaltyRedemption),
}));

export const loyaltyTransactionRelations = relations(loyaltyTransaction, ({ one }) => ({
  account: one(loyaltyAccount, {
    fields: [loyaltyTransaction.accountId],
    references: [loyaltyAccount.id],
  }),
}));

export const loyaltyRedemptionRelations = relations(loyaltyRedemption, ({ one }) => ({
  account: one(loyaltyAccount, {
    fields: [loyaltyRedemption.accountId],
    references: [loyaltyAccount.id],
  }),
  reward: one(loyaltyReward, {
    fields: [loyaltyRedemption.rewardId],
    references: [loyaltyReward.id],
  }),
}));
