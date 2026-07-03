import { CartStatus, OrderChannel, OrderStatus, ShipmentStatus, ShippingMethod } from "@cloudcommerce/types";
import { relations, sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { productVariant } from "./catalog.js";
import { customer, customerAddress } from "./customers.js";
import { adminUser } from "./identity.js";

export const orderStatusEnum = pgEnum("order_status", [
  OrderStatus.DRAFT,
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.RETURN_REQUESTED,
  OrderStatus.RETURNED,
]);

export const orderChannelEnum = pgEnum("order_channel", [OrderChannel.STORE, OrderChannel.ADMIN_MANUAL]);

export const cartStatusEnum = pgEnum("cart_status", [
  CartStatus.ACTIVE,
  CartStatus.CONVERTED,
  CartStatus.ABANDONED,
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  ShipmentStatus.CREATED,
  ShipmentStatus.PREPARED,
  ShipmentStatus.DISPATCHED,
  ShipmentStatus.IN_TRANSIT,
  ShipmentStatus.OUT_FOR_DELIVERY,
  ShipmentStatus.DELIVERED,
  ShipmentStatus.DELAYED,
  ShipmentStatus.FAILED_ATTEMPT,
]);

export const shippingMethodEnum = pgEnum("shipping_method", [
  ShippingMethod.STANDARD,
  ShippingMethod.EXPRESS,
  ShippingMethod.PICKUP,
]);

export const cart = pgTable(
  "cart",
  {
    id: uuid("id").primaryKey(),
    customerId: uuid("customer_id").references(() => customer.id, { onDelete: "set null" }),
    status: cartStatusEnum("status").notNull().default(CartStatus.ACTIVE),
    currency: text("currency").notNull().default("ARS"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    customerIdx: index("idx_cart_customer").on(table.customerId),
    statusExpiryIdx: index("cart_status_expiry_idx").on(table.status, table.expiresAt),
  }),
);

export const cartItem = pgTable(
  "cart_item",
  {
    id: uuid("id").primaryKey(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cart.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceSnapshotMinor: integer("unit_price_snapshot_minor").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cartVariantUnique: uniqueIndex("cart_item_cart_variant_unique").on(table.cartId, table.variantId),
    cartIdx: index("cart_item_cart_idx").on(table.cartId),
    quantityPositive: check("cart_item_quantity_positive", sql`${table.quantity} >= 1`),
    priceNonNegative: check("cart_item_price_non_negative", sql`${table.unitPriceSnapshotMinor} >= 0`),
  }),
);

export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey(),
    orderNumber: text("order_number").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull(),
    channel: orderChannelEnum("channel").notNull(),
    currency: text("currency").notNull().default("ARS"),
    subtotalMinor: integer("subtotal_minor").notNull(),
    shippingMinor: integer("shipping_minor").notNull(),
    discountMinor: integer("discount_minor").notNull().default(0),
    taxMinor: integer("tax_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull(),
    shippingMethod: shippingMethodEnum("shipping_method").notNull(),
    shippingAddressId: uuid("shipping_address_id").references(() => customerAddress.id, { onDelete: "restrict" }),
    placedBy: uuid("placed_by").references(() => adminUser.id, { onDelete: "set null" }),
    notes: text("notes"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    numberUnique: uniqueIndex("order_number_unique").on(table.orderNumber),
    customerCreatedIdx: index("idx_orders_customer_created").on(table.customerId, table.createdAt),
    statusIdx: index("idx_orders_status").on(table.status),
    createdIdx: index("order_created_idx").on(table.createdAt, table.id),
    amountsNonNegative: check(
      "order_amounts_non_negative",
      sql`${table.subtotalMinor} >= 0 AND ${table.shippingMinor} >= 0 AND ${table.discountMinor} >= 0 AND ${table.taxMinor} >= 0 AND ${table.totalMinor} >= 0`,
    ),
    totalMatches: check(
      "order_total_matches_components",
      sql`${table.totalMinor} = ${table.subtotalMinor} + ${table.shippingMinor} + ${table.taxMinor} - ${table.discountMinor}`,
    ),
    shippingAddressRequired: check(
      "order_shipping_address_required",
      sql`${table.shippingMethod} = 'PICKUP' OR ${table.shippingAddressId} IS NOT NULL`,
    ),
    versionPositive: check("order_version_positive", sql`${table.version} >= 1`),
  }),
);

export const orderLine = pgTable(
  "order_line",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "restrict" }),
    productTitleSnapshot: text("product_title_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot"),
    quantity: integer("quantity").notNull(),
    unitPriceMinor: integer("unit_price_minor").notNull(),
    lineTotalMinor: integer("line_total_minor").notNull(),
    supplierCostSnapshotMinor: integer("supplier_cost_snapshot_minor"),
  },
  (table) => ({
    orderIdx: index("idx_order_lines_order").on(table.orderId),
    variantIdx: index("order_line_variant_idx").on(table.variantId),
    quantityPositive: check("order_line_quantity_positive", sql`${table.quantity} >= 1`),
    unitPriceNonNegative: check("order_line_unit_price_non_negative", sql`${table.unitPriceMinor} >= 0`),
    supplierCostNonNegative: check(
      "order_line_supplier_cost_non_negative",
      sql`${table.supplierCostSnapshotMinor} IS NULL OR ${table.supplierCostSnapshotMinor} >= 0`,
    ),
    lineTotalMatches: check("order_line_total_matches", sql`${table.lineTotalMinor} = ${table.unitPriceMinor} * ${table.quantity}`),
  }),
);

export const orderStatusEvent = pgTable(
  "order_status_event",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    fromStatus: orderStatusEnum("from_status"),
    toStatus: orderStatusEnum("to_status").notNull(),
    reason: text("reason"),
    actorId: uuid("actor_id").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderCreatedIdx: index("order_status_event_order_created_idx").on(table.orderId, table.createdAt),
  }),
);

export const shipment = pgTable(
  "shipment",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => order.id, { onDelete: "cascade" }),
    carrier: text("carrier"),
    trackingCode: text("tracking_code"),
    status: shipmentStatusEnum("status").notNull().default(ShipmentStatus.CREATED),
    eta: timestamp("eta", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdx: index("idx_shipments_order").on(table.orderId),
    trackingIdx: index("shipment_tracking_idx").on(table.carrier, table.trackingCode),
  }),
);

export const shipmentEvent = pgTable(
  "shipment_event",
  {
    id: uuid("id").primaryKey(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipment.id, { onDelete: "cascade" }),
    status: shipmentStatusEnum("status").notNull(),
    description: text("description"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    shipmentOccurredIdx: index("shipment_event_shipment_occurred_idx").on(table.shipmentId, table.occurredAt),
  }),
);

export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: uuid("id").primaryKey(),
    key: text("key").notNull(),
    route: text("route").notNull(),
    actorId: uuid("actor_id").references(() => adminUser.id, { onDelete: "set null" }),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseRefType: text("response_ref_type"),
    responseRefId: uuid("response_ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => ({
    routeKeyActorUnique: uniqueIndex("idempotency_key_route_key_actor_unique").on(table.route, table.key, table.actorId),
    keyIdx: index("idx_idem_key").on(table.key),
    expiresIdx: index("idempotency_key_expires_idx").on(table.expiresAt),
  }),
);

export const orderRelations = relations(order, ({ one, many }) => ({
  customer: one(customer, {
    fields: [order.customerId],
    references: [customer.id],
  }),
  shippingAddress: one(customerAddress, {
    fields: [order.shippingAddressId],
    references: [customerAddress.id],
  }),
  lines: many(orderLine),
  statusHistory: many(orderStatusEvent),
  shipments: many(shipment),
}));

export const orderLineRelations = relations(orderLine, ({ one }) => ({
  order: one(order, {
    fields: [orderLine.orderId],
    references: [order.id],
  }),
  variant: one(productVariant, {
    fields: [orderLine.variantId],
    references: [productVariant.id],
  }),
}));

export const shipmentRelations = relations(shipment, ({ one, many }) => ({
  order: one(order, {
    fields: [shipment.orderId],
    references: [order.id],
  }),
  events: many(shipmentEvent),
}));

export const shipmentEventRelations = relations(shipmentEvent, ({ one }) => ({
  shipment: one(shipment, {
    fields: [shipmentEvent.shipmentId],
    references: [shipment.id],
  }),
}));
