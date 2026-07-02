import type { Currency, OrderChannel, OrderStatus, ShipmentStatus, ShippingMethod } from "@cloudcommerce/types";

export type RequestAuditContext = {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  reason?: string | null;
};

export type OrderEntity = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  channel: OrderChannel;
  currency: Currency;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  shippingMethod: ShippingMethod;
  shippingAddressId: string | null;
  placedBy: string | null;
  notes: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderLineEntity = {
  id: string;
  orderId: string;
  variantId: string;
  productTitleSnapshot: string;
  skuSnapshot: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  supplierCostSnapshotMinor: number | null;
};

export type OrderStatusEventEntity = {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  reason: string | null;
  actorId: string | null;
  createdAt: Date;
};

export type ShipmentEventEntity = {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  description: string | null;
  occurredAt: Date;
};

export type ShipmentEntity = {
  id: string;
  orderId: string;
  carrier: string | null;
  trackingCode: string | null;
  status: ShipmentStatus;
  eta: Date | null;
  createdAt: Date;
  updatedAt: Date;
  events: ShipmentEventEntity[];
};

export type OrderAggregate = {
  order: OrderEntity;
  lines: OrderLineEntity[];
  statusHistory: OrderStatusEventEntity[];
  shipments: ShipmentEntity[];
};

export type OrderSummaryEntity = OrderEntity & {
  itemCount: number;
};

export type ListOrdersQuery = {
  status?: OrderStatus;
  channel?: "store" | "admin_manual";
  customerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sort: "newest" | "total-desc" | "total-asc";
  cursor?: string;
  limit: number;
};

export type CreateManualOrderLineRecord = {
  variantId: string;
  quantity: number;
  unitPriceMinor: number;
  supplierCostSnapshotMinor: number | null;
};

export type CreateManualOrderRecord = {
  idempotencyKey: string | null;
  requestHash: string;
  customerId: string;
  shippingMethod: ShippingMethod;
  shippingAddressId: string | null;
  initialStatus: OrderStatus.CONFIRMED | OrderStatus.PENDING_CONFIRMATION;
  currency: Currency;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  notes: string | null;
  placedBy: string | null;
  lines: CreateManualOrderLineRecord[];
};

export type CreateManualOrderResult =
  | { type: "CREATED"; aggregate: OrderAggregate }
  | { type: "REUSED"; aggregate: OrderAggregate }
  | { type: "IDEMPOTENCY_CONFLICT" }
  | { type: "CUSTOMER_NOT_FOUND" }
  | { type: "ADDRESS_NOT_DELIVERABLE" }
  | { type: "PRODUCT_NOT_AVAILABLE"; variantId: string }
  | { type: "INSUFFICIENT_STOCK"; variantId: string };

export interface OrderRepository {
  createManualOrder(input: CreateManualOrderRecord, audit: RequestAuditContext): Promise<CreateManualOrderResult>;
  getOrderAggregate(orderId: string): Promise<OrderAggregate | null>;
  listOrders(input: ListOrdersQuery): Promise<{ rows: OrderSummaryEntity[]; nextCursor: string | null }>;
  transitionOrder(input: {
    orderId: string;
    toStatus: OrderStatus;
    reason: string | null;
    actorId: string | null;
  }): Promise<OrderAggregate | null>;
  createShipment(input: {
    orderId: string;
    carrier: string | null;
    trackingCode: string | null;
    eta: Date | null;
    actorId: string | null;
  }): Promise<ShipmentEntity | null>;
  getShipmentById(shipmentId: string): Promise<ShipmentEntity | null>;
  applySupplierShipmentUpdate(input: {
    orderId: string;
    status: ShipmentStatus;
    carrier: string | null;
    trackingCode: string | null;
    description: string | null;
    occurredAt: Date;
  }): Promise<ShipmentEntity | null>;
  recordSensitiveAccess(input: { orderId: string; action: string }, audit: RequestAuditContext): Promise<void>;
}
