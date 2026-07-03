import {
  OrderStatus,
  ShipmentStatus,
  ShippingMethod,
  type Actor,
  type Currency,
  type Money,
  type OrderDetail,
  type OrderLineView,
  type OrderListResult,
  type ShipmentView,
  type TrackingView,
} from "@cloudcommerce/types";
import type {
  CancelOrderInput,
  CreateManualOrderInput,
  CreateShipmentInput,
  GetOrderInput,
  ListOrdersInput,
  RefreshTrackingInput,
  TransitionOrderInput,
} from "@cloudcommerce/validators";
import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { OrderDomainError } from "../../../shared/errors/domain-error.js";
import type { InMemoryEventBus } from "../../../shared/events/event-bus.js";
import {
  canCancelOrders,
  canCreateManualOrder,
  canManageShipments,
  canReadOrders,
  canTransitionOrders,
  canViewOrderCost,
  requiresOrderSensitiveReason,
} from "../domain/order-permissions.js";
import { canTransitionOrder } from "../domain/order-state-machine.js";
import type { OrderPricingPort } from "./order-pricing-port.js";
import type {
  CreateManualOrderLineRecord,
  ListOrdersQuery,
  OrderAggregate,
  OrderLineEntity,
  OrderRepository,
  OrderStatusEventEntity,
  RequestAuditContext,
  ShipmentEntity,
} from "./order-repository.js";

type RequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
  reason?: string | null;
  idempotencyKey?: string | null;
};

const defaultCurrency: Currency = "ARS";

export class OrderService {
  public constructor(
    private readonly repository: OrderRepository,
    private readonly pricing: OrderPricingPort,
    private readonly eventBus?: InMemoryEventBus,
  ) {}

  public async createManualOrder(
    actor: Actor,
    input: CreateManualOrderInput,
    context: RequestContext,
  ): Promise<Result<OrderDetail, OrderDomainError>> {
    if (!canCreateManualOrder(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const initialStatus = input.initialStatus ?? OrderStatus.CONFIRMED;
    const transition = canTransitionOrder({ from: null, to: initialStatus });
    if (!transition.ok) {
      return err({ type: transition.failure });
    }
    if (input.shippingMethod !== ShippingMethod.PICKUP && !input.shippingAddressId) {
      return err({ type: "ADDRESS_NOT_DELIVERABLE" });
    }
    const pricedLines: CreateManualOrderLineRecord[] = [];
    for (const line of input.lines) {
      const snapshot = await this.pricing.getSnapshot({ variantId: line.variantId, currency: defaultCurrency });
      if (!snapshot) {
        return err({ type: "PRICING_UNAVAILABLE", variantId: line.variantId });
      }
      pricedLines.push({
        variantId: line.variantId,
        quantity: line.quantity,
        unitPriceMinor: snapshot.unitPriceMinor,
        supplierCostSnapshotMinor: snapshot.supplierCostMinor,
      });
    }

    const result = await this.repository.createManualOrder(
      {
        idempotencyKey: context.idempotencyKey ?? null,
        requestHash: this.hashPayload(input),
        customerId: input.customerId,
        shippingMethod: input.shippingMethod,
        shippingAddressId: input.shippingAddressId ?? null,
        initialStatus,
        currency: defaultCurrency,
        shippingMinor: shippingAmount(input.shippingMethod),
        discountMinor: 0,
        taxMinor: 0,
        notes: input.notes ?? null,
        placedBy: actor.kind === "admin" ? actor.userId : null,
        lines: pricedLines,
      },
      this.audit(actor, context, "order.create_manual"),
    );

    switch (result.type) {
      case "CREATED":
        await this.publishOrderEvent("OrderCreated", result.aggregate.order.id, {
          orderId: result.aggregate.order.id,
          orderNumber: result.aggregate.order.orderNumber,
          status: result.aggregate.order.status,
        });
        if (result.aggregate.order.status === OrderStatus.CONFIRMED) {
          await this.publishOrderEvent("OrderConfirmed", result.aggregate.order.id, {
            orderId: result.aggregate.order.id,
            orderNumber: result.aggregate.order.orderNumber,
          });
        }
        return ok(this.presentDetail(result.aggregate, canViewOrderCost(actor)));
      case "REUSED":
        return ok(this.presentDetail(result.aggregate, canViewOrderCost(actor)));
      case "IDEMPOTENCY_CONFLICT":
        return err({ type: "IDEMPOTENCY_CONFLICT" });
      case "CUSTOMER_NOT_FOUND":
        return err({ type: "CUSTOMER_NOT_FOUND" });
      case "ADDRESS_NOT_DELIVERABLE":
        return err({ type: "ADDRESS_NOT_DELIVERABLE" });
      case "PRODUCT_NOT_AVAILABLE":
        return err({ type: "PRODUCT_NOT_AVAILABLE", variantId: result.variantId });
      case "INSUFFICIENT_STOCK":
        return err({ type: "INSUFFICIENT_STOCK", variantId: result.variantId });
    }
  }

  public async getDetail(
    actor: Actor,
    input: GetOrderInput,
    context: RequestContext,
  ): Promise<Result<OrderDetail, OrderDomainError>> {
    if (!canReadOrders(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (requiresOrderSensitiveReason(actor) && !input.reason?.trim()) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const aggregate = await this.repository.getOrderAggregate(input.orderId);
    if (!aggregate) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    if (requiresOrderSensitiveReason(actor)) {
      await this.repository.recordSensitiveAccess(
        { orderId: input.orderId, action: "order.detail" },
        this.audit(actor, context, input.reason ?? "order.detail"),
      );
    }
    return ok(this.presentDetail(aggregate, canViewOrderCost(actor)));
  }

  public async list(actor: Actor, input: ListOrdersInput): Promise<Result<OrderListResult, OrderDomainError>> {
    if (!canReadOrders(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const query: ListOrdersQuery = {
      sort: input.sort,
      limit: input.limit,
    };
    if (input.status !== undefined) query.status = input.status;
    if (input.channel !== undefined) query.channel = input.channel;
    if (input.customerId !== undefined) query.customerId = input.customerId;
    if (input.dateFrom !== undefined) query.dateFrom = input.dateFrom;
    if (input.dateTo !== undefined) query.dateTo = input.dateTo;
    if (input.cursor !== undefined) query.cursor = input.cursor;
    const rows = await this.repository.listOrders(query);
    return ok({
      items: rows.rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        customerId: row.customerId,
        status: row.status,
        channel: row.channel,
        currency: row.currency,
        itemCount: row.itemCount,
        total: money(row.totalMinor, row.currency),
        shippingMethod: row.shippingMethod,
        createdAt: row.createdAt,
      })),
      nextCursor: rows.nextCursor,
    });
  }

  public async transition(
    actor: Actor,
    input: TransitionOrderInput,
  ): Promise<Result<OrderDetail, OrderDomainError>> {
    if (!canTransitionOrders(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const current = await this.repository.getOrderAggregate(input.orderId);
    if (!current) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    const transition = canTransitionOrder({
      from: current.order.status,
      to: input.toStatus,
      reason: input.reason ?? null,
      hasShipment: current.shipments.length > 0,
    });
    if (!transition.ok) {
      return err({ type: transition.failure });
    }
    const updated = await this.repository.transitionOrder({
      orderId: input.orderId,
      toStatus: input.toStatus,
      reason: input.reason ?? null,
      actorId: actor.kind === "admin" ? actor.userId : null,
    });
    if (!updated) {
      const latest = await this.repository.getOrderAggregate(input.orderId);
      if (latest) {
        return err({ type: "INVALID_ORDER_STATE" });
      }
      return err({ type: "ORDER_NOT_FOUND" });
    }
    await this.publishOrderEvent(input.toStatus === OrderStatus.CANCELLED ? "OrderCancelled" : "OrderStatusChanged", updated.order.id, {
      orderId: updated.order.id,
      fromStatus: current.order.status,
      toStatus: updated.order.status,
    });
    return ok(this.presentDetail(updated, canViewOrderCost(actor)));
  }

  public async cancel(actor: Actor, input: CancelOrderInput): Promise<Result<OrderDetail, OrderDomainError>> {
    if (!canCancelOrders(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const current = await this.repository.getOrderAggregate(input.orderId);
    if (!current) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    const transition = canTransitionOrder({ from: current.order.status, to: OrderStatus.CANCELLED, reason: input.reason });
    if (!transition.ok) {
      return err({ type: transition.failure });
    }
    const updated = await this.repository.transitionOrder({
      orderId: input.orderId,
      toStatus: OrderStatus.CANCELLED,
      reason: input.reason,
      actorId: actor.kind === "admin" ? actor.userId : null,
    });
    if (!updated) {
      const latest = await this.repository.getOrderAggregate(input.orderId);
      if (latest) {
        return err({ type: "INVALID_ORDER_STATE" });
      }
      return err({ type: "ORDER_NOT_FOUND" });
    }
    await this.publishOrderEvent("OrderCancelled", updated.order.id, {
      orderId: updated.order.id,
      fromStatus: current.order.status,
      toStatus: updated.order.status,
    });
    return ok(this.presentDetail(updated, canViewOrderCost(actor)));
  }

  public async createShipment(
    actor: Actor,
    input: CreateShipmentInput,
  ): Promise<Result<ShipmentView, OrderDomainError>> {
    if (!canManageShipments(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const aggregate = await this.repository.getOrderAggregate(input.orderId);
    if (!aggregate) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    if ([OrderStatus.DRAFT, OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(aggregate.order.status)) {
      return err({ type: "INVALID_ORDER_STATE" });
    }
    const shipment = await this.repository.createShipment({
      orderId: input.orderId,
      carrier: input.carrier ?? null,
      trackingCode: input.trackingCode ?? null,
      eta: input.eta ?? null,
      actorId: actor.kind === "admin" ? actor.userId : null,
    });
    if (!shipment) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    return ok(this.presentShipment(shipment));
  }

  private async advanceOrderFromShipment(actor: Actor, orderId: string, shipmentStatus: ShipmentStatus): Promise<void> {
    const nextStatus = shipmentStatusToOrderStatus(shipmentStatus);
    if (!nextStatus) {
      return;
    }
    const current = await this.repository.getOrderAggregate(orderId);
    if (!current) {
      return;
    }
    const transition = canTransitionOrder({
      from: current.order.status,
      to: nextStatus,
      hasShipment: current.shipments.length > 0,
    });
    if (!transition.ok) {
      return;
    }
    await this.repository.transitionOrder({
      orderId,
      toStatus: nextStatus,
      reason: `supplier_shipment_${shipmentStatus.toLowerCase()}`,
      actorId: actor.kind === "admin" ? actor.userId : null,
    });
    await this.publishOrderEvent("OrderStatusChanged", orderId, {
      orderId,
      fromStatus: current.order.status,
      toStatus: nextStatus,
    });
  }

  private async publishOrderEvent(type: string, orderId: string, payload: Record<string, unknown>): Promise<void> {
    await this.eventBus?.publish({
      id: uuidv7(),
      type,
      aggregateType: "orders",
      aggregateId: orderId,
      payload,
      occurredAt: new Date(),
    });
  }

  /**
   * Actualización de envío que llega del proveedor (webhook de fulfillment).
   * Solo la invoca el dominio suppliers con actor system, o un admin con
   * permiso de envíos al reprocesar manualmente.
   */
  public async applySupplierShipmentUpdate(
    actor: Actor,
    input: {
      orderId: string;
      status: ShipmentStatus;
      carrier?: string | null;
      trackingCode?: string | null;
      description?: string | null;
      occurredAt: Date;
    },
  ): Promise<Result<ShipmentView, OrderDomainError>> {
    if (actor.kind !== "system" && !canManageShipments(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const shipment = await this.repository.applySupplierShipmentUpdate({
      orderId: input.orderId,
      status: input.status,
      carrier: input.carrier ?? null,
      trackingCode: input.trackingCode ?? null,
      description: input.description ?? null,
      occurredAt: input.occurredAt,
    });
    if (!shipment) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    await this.publishOrderEvent("ShipmentStatusChanged", input.orderId, {
      orderId: input.orderId,
      shipmentId: shipment.id,
      status: input.status,
    });
    await this.advanceOrderFromShipment(actor, input.orderId, input.status);
    return ok(this.presentShipment(shipment));
  }

  public async refreshTracking(
    actor: Actor,
    input: RefreshTrackingInput,
  ): Promise<Result<TrackingView, OrderDomainError>> {
    if (!canReadOrders(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const shipment = await this.repository.getShipmentById(input.shipmentId);
    if (!shipment) {
      return err({ type: "SHIPMENT_NOT_FOUND" });
    }
    return ok({
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingCode: shipment.trackingCode,
      eta: shipment.eta,
      events: shipment.events.map((event) => ({
        status: event.status,
        description: event.description,
        occurredAt: event.occurredAt,
      })),
      stale: false,
    });
  }

  private presentDetail(aggregate: OrderAggregate, includeCost: boolean): OrderDetail {
    const itemCount = aggregate.lines.reduce((sum, line) => sum + line.quantity, 0);
    const base: OrderDetail = {
      id: aggregate.order.id,
      orderNumber: aggregate.order.orderNumber,
      customerId: aggregate.order.customerId,
      status: aggregate.order.status,
      channel: aggregate.order.channel,
      currency: aggregate.order.currency,
      itemCount,
      total: money(aggregate.order.totalMinor, aggregate.order.currency),
      shippingMethod: aggregate.order.shippingMethod,
      createdAt: aggregate.order.createdAt,
      subtotal: money(aggregate.order.subtotalMinor, aggregate.order.currency),
      shipping: money(aggregate.order.shippingMinor, aggregate.order.currency),
      discount: money(aggregate.order.discountMinor, aggregate.order.currency),
      tax: money(aggregate.order.taxMinor, aggregate.order.currency),
      shippingAddressId: aggregate.order.shippingAddressId,
      placedBy: aggregate.order.placedBy,
      notes: aggregate.order.notes,
      lines: aggregate.lines.map((line) => this.presentLine(line, aggregate.order.currency, includeCost)),
      statusHistory: aggregate.statusHistory.map((event) => this.presentStatusEvent(event)),
      updatedAt: aggregate.order.updatedAt,
      costVisible: includeCost,
    };
    if (!includeCost) {
      return base;
    }
    if (aggregate.lines.some((line) => line.supplierCostSnapshotMinor === null)) {
      return base;
    }
    return {
      ...base,
      totalMargin: money(
        aggregate.lines.reduce((sum, line) => sum + line.lineTotalMinor - line.supplierCostSnapshotMinor! * line.quantity, 0),
        aggregate.order.currency,
      ),
    };
  }

  private presentLine(line: OrderLineEntity, currency: Currency, includeCost: boolean): OrderLineView {
    const base: OrderLineView = {
      id: line.id,
      variantId: line.variantId,
      productTitle: line.productTitleSnapshot,
      sku: line.skuSnapshot,
      quantity: line.quantity,
      unitPrice: money(line.unitPriceMinor, currency),
      lineTotal: money(line.lineTotalMinor, currency),
    };
    if (!includeCost) {
      return base;
    }
    if (line.supplierCostSnapshotMinor === null) {
      return { ...base, costUnknown: true };
    }
    return {
      ...base,
      supplierCost: money(line.supplierCostSnapshotMinor, currency),
      lineMargin: money(line.lineTotalMinor - line.supplierCostSnapshotMinor * line.quantity, currency),
    };
  }

  private presentStatusEvent(event: OrderStatusEventEntity) {
    return {
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      actorId: event.actorId,
      createdAt: event.createdAt,
    };
  }

  private presentShipment(shipment: ShipmentEntity): ShipmentView {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      carrier: shipment.carrier,
      trackingCode: shipment.trackingCode,
      status: shipment.status,
      eta: shipment.eta,
      events: shipment.events.map((event) => ({
        status: event.status,
        description: event.description,
        occurredAt: event.occurredAt,
      })),
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }

  private hashPayload(input: CreateManualOrderInput): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          customerId: input.customerId,
          shippingMethod: input.shippingMethod,
          shippingAddressId: input.shippingAddressId ?? null,
          lines: input.lines,
          discountCode: input.discountCode ?? null,
          notes: input.notes ?? null,
          initialStatus: input.initialStatus ?? OrderStatus.CONFIRMED,
        }),
      )
      .digest("hex");
  }

  private audit(actor: Actor, context: RequestContext, reason: string): RequestAuditContext {
    return {
      actorId: actor.kind === "admin" ? actor.userId : null,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      reason: context.reason ?? reason,
    };
  }
}

const shippingAmount = (method: ShippingMethod): number => {
  switch (method) {
    case ShippingMethod.EXPRESS:
      return 24_900;
    case ShippingMethod.PICKUP:
    case ShippingMethod.STANDARD:
      return 0;
  }
};

const money = (amountMinor: number, currency: Currency): Money => ({ amountMinor, currency });

const shipmentStatusToOrderStatus = (status: ShipmentStatus): OrderStatus | null => {
  switch (status) {
    case ShipmentStatus.PREPARED:
      return OrderStatus.READY_TO_SHIP;
    case ShipmentStatus.DISPATCHED:
    case ShipmentStatus.IN_TRANSIT:
    case ShipmentStatus.OUT_FOR_DELIVERY:
      return OrderStatus.SHIPPED;
    case ShipmentStatus.DELIVERED:
      return OrderStatus.DELIVERED;
    case ShipmentStatus.CREATED:
    case ShipmentStatus.DELAYED:
    case ShipmentStatus.FAILED_ATTEMPT:
      return null;
  }
};
