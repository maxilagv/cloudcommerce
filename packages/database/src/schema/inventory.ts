import { ReservationStatus, StockMovementType } from "@cloudcommerce/types";
import { relations, sql } from "drizzle-orm";
import {
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
import { productVariant } from "./catalog.js";
import { adminUser } from "./identity.js";

export const reservationStatusEnum = pgEnum("reservation_status", [
  ReservationStatus.ACTIVE,
  ReservationStatus.CONFIRMED,
  ReservationStatus.RELEASED,
  ReservationStatus.EXPIRED,
]);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  StockMovementType.IMPORT,
  StockMovementType.SALE,
  StockMovementType.RETURN,
  StockMovementType.ADJUSTMENT,
  StockMovementType.RESERVATION,
  StockMovementType.RELEASE,
]);

export const stockItem = pgTable(
  "stock_item",
  {
    id: uuid("id").primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    onHand: integer("on_hand").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    reorderPoint: integer("reorder_point"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    variantUnique: uniqueIndex("stock_item_variant_unique").on(table.variantId),
    variantLookupIdx: index("stock_item_variant_idx").on(table.variantId),
    nonNegativeCheck: check("stock_item_non_negative", sql`${table.onHand} >= 0 AND ${table.reserved} >= 0`),
    reservedCheck: check("stock_item_reserved_le_on_hand", sql`${table.reserved} <= ${table.onHand}`),
    reorderPointCheck: check("stock_item_reorder_point_non_negative", sql`${table.reorderPoint} IS NULL OR ${table.reorderPoint} >= 0`),
  }),
);

export const stockReservation = pgTable(
  "stock_reservation",
  {
    id: uuid("id").primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    orderId: uuid("order_id"),
    quantity: integer("quantity").notNull(),
    status: reservationStatusEnum("status").notNull().default(ReservationStatus.ACTIVE),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    variantStatusIdx: index("stock_reservation_variant_status_idx").on(table.variantId, table.status),
    activeExpiryIdx: index("stock_reservation_active_expiry_idx").on(table.status, table.expiresAt),
    orderIdx: index("stock_reservation_order_idx").on(table.orderId),
    quantityPositive: check("stock_reservation_quantity_positive", sql`${table.quantity} > 0`),
  }),
);

export const stockMovement = pgTable(
  "stock_movement",
  {
    id: uuid("id").primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    type: stockMovementTypeEnum("type").notNull(),
    quantity: integer("quantity").notNull(),
    reason: text("reason"),
    refType: text("ref_type"),
    refId: text("ref_id"),
    createdBy: uuid("created_by").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    variantCreatedIdx: index("stock_movement_variant_created_idx").on(table.variantId, table.createdAt),
    refIdx: index("stock_movement_ref_idx").on(table.refType, table.refId),
    quantityNotZero: check("stock_movement_quantity_not_zero", sql`${table.quantity} <> 0`),
  }),
);

export const stockItemRelations = relations(stockItem, ({ one }) => ({
  variant: one(productVariant, {
    fields: [stockItem.variantId],
    references: [productVariant.id],
  }),
}));

export const stockReservationRelations = relations(stockReservation, ({ one }) => ({
  variant: one(productVariant, {
    fields: [stockReservation.variantId],
    references: [productVariant.id],
  }),
}));

export const stockMovementRelations = relations(stockMovement, ({ one }) => ({
  variant: one(productVariant, {
    fields: [stockMovement.variantId],
    references: [productVariant.id],
  }),
  createdByAdmin: one(adminUser, {
    fields: [stockMovement.createdBy],
    references: [adminUser.id],
  }),
}));
