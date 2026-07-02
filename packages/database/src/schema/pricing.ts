import { PriceOrigin, PricingScope, PricingValueKind } from "@cloudcommerce/types";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { category, product, productVariant } from "./catalog.js";
import { adminUser } from "./identity.js";

export const pricingScopeEnum = pgEnum("pricing_scope", [
  PricingScope.GLOBAL,
  PricingScope.CATEGORY,
  PricingScope.PRODUCT,
]);

export const pricingValueKindEnum = pgEnum("pricing_value_kind", [
  PricingValueKind.PERCENT,
  PricingValueKind.FIXED,
]);

export const priceOriginEnum = pgEnum("price_origin", [PriceOrigin.COMPUTED, PriceOrigin.MANUAL]);

export const priceList = pgTable(
  "price_list",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    currency: text("currency").notNull().default("ARS"),
  },
  (table) => ({
    nameUnique: uniqueIndex("price_list_name_unique").on(table.name),
    currencyDefaultIdx: index("price_list_currency_default_idx").on(table.currency, table.isDefault),
  }),
);

export const supplierCost = pgTable(
  "supplier_cost",
  {
    id: uuid("id").primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id"),
    costAmountMinor: integer("cost_amount_minor").notNull(),
    currency: text("currency").notNull().default("ARS"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    variantValidityIdx: index("idx_supplier_cost_variant_valid").on(table.variantId, table.validFrom, table.validTo),
    costNonNegative: check("supplier_cost_non_negative", sql`${table.costAmountMinor} >= 0`),
    validityCheck: check("supplier_cost_validity_order", sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`),
  }),
);

export const markupRule = pgTable(
  "markup_rule",
  {
    id: uuid("id").primaryKey(),
    scope: pricingScopeEnum("scope").notNull(),
    scopeId: uuid("scope_id"),
    kind: pricingValueKindEnum("kind").notNull(),
    value: integer("value").notNull(),
    minMarginBps: integer("min_margin_bps"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scopeIdx: index("idx_markup_scope_active").on(table.scope, table.scopeId, table.isActive),
    valueNonNegative: check("markup_rule_value_non_negative", sql`${table.value} >= 0`),
    marginRange: check(
      "markup_rule_min_margin_range",
      sql`${table.minMarginBps} IS NULL OR (${table.minMarginBps} >= 0 AND ${table.minMarginBps} <= 9500)`,
    ),
    globalScopeCheck: check(
      "markup_rule_scope_id_required",
      sql`(${table.scope} = 'global' AND ${table.scopeId} IS NULL) OR (${table.scope} <> 'global' AND ${table.scopeId} IS NOT NULL)`,
    ),
  }),
);

export const price = pgTable(
  "price",
  {
    id: uuid("id").primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => priceList.id, { onDelete: "restrict" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("ARS"),
    compareAtAmountMinor: integer("compare_at_amount_minor"),
    origin: priceOriginEnum("origin").notNull().default(PriceOrigin.COMPUTED),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    variantListValidityIdx: index("idx_price_variant_list_valid").on(table.variantId, table.listId, table.validFrom, table.validTo),
    amountNonNegative: check("price_amount_non_negative", sql`${table.amountMinor} >= 0`),
    compareAtCheck: check(
      "price_compare_at_greater",
      sql`${table.compareAtAmountMinor} IS NULL OR ${table.compareAtAmountMinor} > ${table.amountMinor}`,
    ),
    validityCheck: check("price_validity_order", sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`),
  }),
);

export const discount = pgTable(
  "discount",
  {
    id: uuid("id").primaryKey(),
    code: text("code"),
    kind: pricingValueKindEnum("kind").notNull(),
    value: integer("value").notNull(),
    scope: pricingScopeEnum("scope").notNull(),
    scopeId: uuid("scope_id"),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    codeUnique: uniqueIndex("discount_code_unique").on(table.code),
    activeIdx: index("idx_discount_active_valid").on(table.isActive, table.validFrom, table.validTo),
    scopeIdx: index("discount_scope_idx").on(table.scope, table.scopeId),
    valueNonNegative: check("discount_value_non_negative", sql`${table.value} >= 0`),
    useCountCheck: check(
      "discount_use_count_valid",
      sql`${table.maxUses} IS NULL OR (${table.maxUses} >= 0 AND ${table.usedCount} <= ${table.maxUses})`,
    ),
    validityCheck: check("discount_validity_order", sql`${table.validTo} IS NULL OR ${table.validTo} > ${table.validFrom}`),
    globalScopeCheck: check(
      "discount_scope_id_required",
      sql`(${table.scope} = 'global' AND ${table.scopeId} IS NULL) OR (${table.scope} <> 'global' AND ${table.scopeId} IS NOT NULL)`,
    ),
  }),
);

export const priceRelations = relations(price, ({ one }) => ({
  variant: one(productVariant, {
    fields: [price.variantId],
    references: [productVariant.id],
  }),
  list: one(priceList, {
    fields: [price.listId],
    references: [priceList.id],
  }),
  createdByAdmin: one(adminUser, {
    fields: [price.createdBy],
    references: [adminUser.id],
  }),
}));

export const supplierCostRelations = relations(supplierCost, ({ one }) => ({
  variant: one(productVariant, {
    fields: [supplierCost.variantId],
    references: [productVariant.id],
  }),
}));

export const markupRuleRelations = relations(markupRule, ({ one }) => ({
  createdByAdmin: one(adminUser, {
    fields: [markupRule.createdBy],
    references: [adminUser.id],
  }),
  category: one(category, {
    fields: [markupRule.scopeId],
    references: [category.id],
  }),
  product: one(product, {
    fields: [markupRule.scopeId],
    references: [product.id],
  }),
}));
