import {
  accessLog,
  auditLog,
  customer,
  customerAddress,
  idempotencyKey,
  order as orderTable,
  orderLine,
  orderStatusEvent,
  outboxEvent,
  product,
  productVariant,
  shipment,
  shipmentEvent,
  stockItem,
  stockMovement,
  stockReservation,
} from "@cloudcommerce/database";
import { OrderChannel, OrderStatus, ProductStatus, ReservationStatus, ShipmentStatus, StockMovementType, type Currency } from "@cloudcommerce/types";
import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import { formatOrderNumber } from "../../domain/value-objects.js";
import { canTransitionOrder } from "../../domain/order-state-machine.js";
import type {
  CreateManualOrderRecord,
  CreateManualOrderResult,
  ListOrdersQuery,
  OrderAggregate,
  OrderEntity,
  AppliedSupplierShipmentUpdate,
  OrderLineEntity,
  OrderRepository,
  OrderStatusEventEntity,
  OrderSummaryEntity,
  RequestAuditContext,
  ShipmentEntity,
  ShipmentEventEntity,
} from "../../application/order-repository.js";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type VariantSnapshot = {
  variantId: string;
  productTitleSnapshot: string;
  skuSnapshot: string | null;
};

type OrderListCursor = {
  createdAt: string;
  id: string;
  totalMinor: number;
};

class InsufficientStockError extends Error {
  public constructor(public readonly variantId: string) {
    super("Insufficient stock");
  }
}

export class DrizzleOrderRepository implements OrderRepository {
  private readonly idempotencyRoute = "orders.createManual";

  public constructor(private readonly db: Database) {}

  public async createManualOrder(input: CreateManualOrderRecord, audit: RequestAuditContext): Promise<CreateManualOrderResult> {
    try {
      const orderId = await this.db.transaction(async (tx) => {
        const existingIdempotency = input.idempotencyKey
          ? await tx.query.idempotencyKey.findFirst({
              where: and(
                eq(idempotencyKey.route, this.idempotencyRoute),
                eq(idempotencyKey.key, input.idempotencyKey),
                input.placedBy ? eq(idempotencyKey.actorId, input.placedBy) : isNull(idempotencyKey.actorId),
              ),
            })
          : null;
        if (existingIdempotency) {
          if (existingIdempotency.requestHash !== input.requestHash) {
            return { type: "IDEMPOTENCY_CONFLICT" as const };
          }
          if (existingIdempotency.responseRefId) {
            return { type: "REUSED" as const, orderId: existingIdempotency.responseRefId };
          }
          return { type: "IDEMPOTENCY_CONFLICT" as const };
        }

        const existingCustomer = await tx.query.customer.findFirst({
          where: and(eq(customer.id, input.customerId), isNull(customer.deletedAt)),
          columns: { id: true },
        });
        if (!existingCustomer) {
          return { type: "CUSTOMER_NOT_FOUND" as const };
        }
        if (input.shippingAddressId) {
          const address = await tx.query.customerAddress.findFirst({
            where: and(eq(customerAddress.id, input.shippingAddressId), eq(customerAddress.customerId, input.customerId)),
            columns: { id: true },
          });
          if (!address) {
            return { type: "ADDRESS_NOT_DELIVERABLE" as const };
          }
        }

        const variantSnapshots = new Map<string, VariantSnapshot>();
        for (const line of input.lines) {
          const snapshot = await this.findVariantSnapshot(tx, line.variantId);
          if (!snapshot) {
            return { type: "PRODUCT_NOT_AVAILABLE" as const, variantId: line.variantId };
          }
          variantSnapshots.set(line.variantId, snapshot);
        }

        const now = new Date();
        const id = uuidv7();
        const orderNumber = await this.nextOrderNumber(tx, now);
        const sortedLines = [...input.lines].sort((left, right) => left.variantId.localeCompare(right.variantId));
        for (const line of sortedLines) {
          const [reservedStock] = await tx
            .update(stockItem)
            .set({
              reserved: sql`${stockItem.reserved} + ${line.quantity}`,
              updatedAt: now,
            })
            .where(
              and(
                eq(stockItem.variantId, line.variantId),
                sql`${stockItem.onHand} - ${stockItem.reserved} >= ${line.quantity}`,
              ),
            )
            .returning();
          if (!reservedStock) {
            throw new InsufficientStockError(line.variantId);
          }
          const reservationId = uuidv7();
          await tx.insert(stockReservation).values({
            id: reservationId,
            variantId: line.variantId,
            orderId: id,
            quantity: line.quantity,
            status: ReservationStatus.CONFIRMED,
            expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          });
          const [confirmedStock] = await tx
            .update(stockItem)
            .set({
              reserved: sql`${stockItem.reserved} - ${line.quantity}`,
              onHand: sql`${stockItem.onHand} - ${line.quantity}`,
              updatedAt: now,
            })
            .where(
              and(
                eq(stockItem.variantId, line.variantId),
                sql`${stockItem.reserved} >= ${line.quantity}`,
                sql`${stockItem.onHand} >= ${line.quantity}`,
              ),
            )
            .returning();
          if (!confirmedStock) {
            throw new InsufficientStockError(line.variantId);
          }
          await tx.insert(stockMovement).values([
            {
              id: uuidv7(),
              variantId: line.variantId,
              type: StockMovementType.RESERVATION,
              quantity: line.quantity,
              reason: "Manual order reservation",
              refType: "order",
              refId: id,
              createdBy: input.placedBy,
            },
            {
              id: uuidv7(),
              variantId: line.variantId,
              type: StockMovementType.RELEASE,
              quantity: -line.quantity,
              reason: "Manual order reservation confirmed",
              refType: "order",
              refId: id,
              createdBy: input.placedBy,
            },
            {
              id: uuidv7(),
              variantId: line.variantId,
              type: StockMovementType.SALE,
              quantity: -line.quantity,
              reason: "Manual order confirmed",
              refType: "order",
              refId: id,
              createdBy: input.placedBy,
            },
          ]);
        }

        const subtotalMinor = input.lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
        const totalMinor = subtotalMinor + input.shippingMinor + input.taxMinor - input.discountMinor;
        const [createdOrder] = await tx
          .insert(orderTable)
          .values({
            id,
            orderNumber,
            customerId: input.customerId,
            status: input.initialStatus,
            channel: OrderChannel.ADMIN_MANUAL,
            currency: input.currency,
            subtotalMinor,
            shippingMinor: input.shippingMinor,
            discountMinor: input.discountMinor,
            taxMinor: input.taxMinor,
            totalMinor,
            shippingMethod: input.shippingMethod,
            shippingAddressId: input.shippingAddressId,
            placedBy: input.placedBy,
            notes: input.notes,
            confirmedAt: input.initialStatus === OrderStatus.CONFIRMED ? now : null,
            version: 1,
          })
          .returning();
        if (!createdOrder) {
          throw new Error("Failed to create order");
        }

        await tx.insert(orderLine).values(
          input.lines.map((line) => {
            const snapshot = variantSnapshots.get(line.variantId);
            if (!snapshot) {
              throw new Error("Missing variant snapshot");
            }
            return {
              id: uuidv7(),
              orderId: id,
              variantId: line.variantId,
              productTitleSnapshot: snapshot.productTitleSnapshot,
              skuSnapshot: snapshot.skuSnapshot,
              quantity: line.quantity,
              unitPriceMinor: line.unitPriceMinor,
              lineTotalMinor: line.unitPriceMinor * line.quantity,
              supplierCostSnapshotMinor: line.supplierCostSnapshotMinor,
            };
          }),
        );

        await tx.insert(orderStatusEvent).values({
          id: uuidv7(),
          orderId: id,
          fromStatus: null,
          toStatus: input.initialStatus,
          reason: "Manual order created",
          actorId: input.placedBy,
        });
        await tx.insert(auditLog).values({
          id: uuidv7(),
          actorId: audit.actorId,
          action: "order.create_manual",
          resourceType: "order",
          resourceId: id,
          before: null,
          after: { lines: input.lines.length, status: input.initialStatus },
          ip: audit.ip,
          userAgent: audit.userAgent,
          requestId: audit.requestId,
          reason: audit.reason ?? null,
        });
        await tx.insert(outboxEvent).values([
          {
            id: uuidv7(),
            aggregateType: "orders",
            aggregateId: id,
            eventType: "OrderCreated",
            payload: { orderId: id, orderNumber },
          },
          {
            id: uuidv7(),
            aggregateType: "orders",
            aggregateId: id,
            eventType: input.initialStatus === OrderStatus.CONFIRMED ? "OrderConfirmed" : "OrderPendingConfirmation",
            payload: { orderId: id, orderNumber },
          },
        ]);
        if (input.idempotencyKey) {
          await tx.insert(idempotencyKey).values({
            id: uuidv7(),
            key: input.idempotencyKey,
            route: this.idempotencyRoute,
            actorId: input.placedBy,
            requestHash: input.requestHash,
            responseStatus: 201,
            responseRefType: "order",
            responseRefId: id,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          });
        }
        return { type: "CREATED" as const, orderId: id };
      });

      if (orderId.type === "IDEMPOTENCY_CONFLICT" || orderId.type === "CUSTOMER_NOT_FOUND" || orderId.type === "ADDRESS_NOT_DELIVERABLE" || orderId.type === "PRODUCT_NOT_AVAILABLE") {
        return orderId;
      }
      const aggregate = await this.getOrderAggregate(orderId.orderId);
      if (!aggregate) {
        throw new Error("Created order could not be loaded");
      }
      return { type: orderId.type, aggregate };
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        return { type: "INSUFFICIENT_STOCK", variantId: error.variantId };
      }
      throw error;
    }
  }

  public async getOrderAggregate(orderId: string): Promise<OrderAggregate | null> {
    const row = await this.db.query.order.findFirst({ where: eq(orderTable.id, orderId) });
    if (!row) {
      return null;
    }
    const [lines, history, shipments] = await Promise.all([
      this.db.select().from(orderLine).where(eq(orderLine.orderId, orderId)).orderBy(asc(orderLine.id)),
      this.db.select().from(orderStatusEvent).where(eq(orderStatusEvent.orderId, orderId)).orderBy(asc(orderStatusEvent.createdAt)),
      this.listShipments(orderId),
    ]);
    return {
      order: this.mapOrder(row),
      lines: lines.map((line) => this.mapLine(line)),
      statusHistory: history.map((event) => this.mapStatusEvent(event)),
      shipments,
    };
  }

  public async listOrders(input: ListOrdersQuery): Promise<{ rows: OrderSummaryEntity[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (input.status !== undefined) conditions.push(eq(orderTable.status, input.status));
    if (input.channel !== undefined) conditions.push(eq(orderTable.channel, input.channel as OrderChannel));
    if (input.customerId !== undefined) conditions.push(eq(orderTable.customerId, input.customerId));
    if (input.dateFrom !== undefined) conditions.push(gte(orderTable.createdAt, input.dateFrom));
    if (input.dateTo !== undefined) conditions.push(lte(orderTable.createdAt, input.dateTo));
    const cursor = this.decodeCursor(input.cursor);
    if (cursor) {
      if (input.sort === "total-desc") {
        conditions.push(
          or(lt(orderTable.totalMinor, cursor.totalMinor), and(eq(orderTable.totalMinor, cursor.totalMinor), lt(orderTable.id, cursor.id))) ??
            sql`false`,
        );
      } else if (input.sort === "total-asc") {
        conditions.push(
          or(
            sql`${orderTable.totalMinor} > ${cursor.totalMinor}`,
            and(eq(orderTable.totalMinor, cursor.totalMinor), sql`${orderTable.id} > ${cursor.id}`),
          ) ?? sql`false`,
        );
      } else {
        const cursorDate = new Date(cursor.createdAt);
        if (!Number.isNaN(cursorDate.getTime())) {
          conditions.push(or(lt(orderTable.createdAt, cursorDate), and(eq(orderTable.createdAt, cursorDate), lt(orderTable.id, cursor.id))) ?? sql`false`);
        }
      }
    }
    const itemCount = sql<number>`(
      select coalesce(sum(ol.quantity), 0)::int
      from order_line ol
      where ol.order_id = ${orderTable.id}
    )`;
    const orderBy =
      input.sort === "total-desc"
        ? [desc(orderTable.totalMinor), desc(orderTable.id)]
        : input.sort === "total-asc"
          ? [asc(orderTable.totalMinor), asc(orderTable.id)]
          : [desc(orderTable.createdAt), desc(orderTable.id)];
    const rows = conditions.length > 0
      ? await this.db
          .select({ ...this.orderSelectFields(), itemCount })
          .from(orderTable)
          .where(and(...conditions))
          .orderBy(...orderBy)
          .limit(input.limit + 1)
      : await this.db
          .select({ ...this.orderSelectFields(), itemCount })
          .from(orderTable)
          .orderBy(...orderBy)
          .limit(input.limit + 1);
    const visibleRows = rows.slice(0, input.limit).map((row) => ({ ...this.mapOrder(row), itemCount: row.itemCount }));
    const lastRow = visibleRows[visibleRows.length - 1];
    return {
      rows: visibleRows,
      nextCursor: rows.length > input.limit && lastRow ? this.encodeCursor(lastRow) : null,
    };
  }

  public async transitionOrder(input: {
    orderId: string;
    toStatus: OrderStatus;
    reason: string | null;
    actorId: string | null;
  }): Promise<OrderAggregate | null> {
    const updatedId = await this.db.transaction(async (tx) => {
      const current = await tx.query.order.findFirst({ where: eq(orderTable.id, input.orderId) });
      if (!current) {
        return null;
      }
      const shipmentRows = await tx
        .select({ id: shipment.id })
        .from(shipment)
        .where(eq(shipment.orderId, input.orderId))
        .limit(1);
      const transition = canTransitionOrder({
        from: current.status,
        to: input.toStatus,
        reason: input.reason,
        hasShipment: shipmentRows.length > 0,
      });
      if (!transition.ok) {
        return null;
      }
      const patch: Partial<typeof orderTable.$inferInsert> = {
        status: input.toStatus,
        updatedAt: new Date(),
        version: sql`${orderTable.version} + 1` as unknown as number,
      };
      if (input.toStatus === OrderStatus.CONFIRMED && current.confirmedAt === null) {
        patch.confirmedAt = new Date();
      }
      const [updated] = await tx
        .update(orderTable)
        .set(patch)
        .where(and(eq(orderTable.id, input.orderId), eq(orderTable.version, current.version)))
        .returning();
      if (!updated) {
        return null;
      }
      await tx.insert(orderStatusEvent).values({
        id: uuidv7(),
        orderId: input.orderId,
        fromStatus: current.status,
        toStatus: input.toStatus,
        reason: input.reason,
        actorId: input.actorId,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "orders",
        aggregateId: input.orderId,
        eventType: "OrderStatusChanged",
        payload: { orderId: input.orderId, fromStatus: current.status, toStatus: input.toStatus },
      });
      return input.orderId;
    });
    return updatedId ? this.getOrderAggregate(updatedId) : null;
  }

  public async createShipment(input: {
    orderId: string;
    carrier: string | null;
    trackingCode: string | null;
    eta: Date | null;
    actorId: string | null;
  }): Promise<ShipmentEntity | null> {
    return this.db.transaction(async (tx) => {
      const current = await tx.query.order.findFirst({ where: eq(orderTable.id, input.orderId), columns: { id: true } });
      if (!current) {
        return null;
      }
      const [created] = await tx
        .insert(shipment)
        .values({
          id: uuidv7(),
          orderId: input.orderId,
          carrier: input.carrier,
          trackingCode: input.trackingCode,
          status: ShipmentStatus.CREATED,
          eta: input.eta,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create shipment");
      }
      const [event] = await tx
        .insert(shipmentEvent)
        .values({
          id: uuidv7(),
          shipmentId: created.id,
          status: ShipmentStatus.CREATED,
          description: "Shipment created",
          occurredAt: new Date(),
        })
        .returning();
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "orders",
        aggregateId: input.orderId,
        eventType: "ShipmentCreated",
        payload: { orderId: input.orderId, shipmentId: created.id },
      });
      return this.mapShipment(created, event ? [event].map((row) => this.mapShipmentEvent(row)) : []);
    });
  }

  public async getShipmentById(shipmentId: string): Promise<ShipmentEntity | null> {
    const row = await this.db.query.shipment.findFirst({ where: eq(shipment.id, shipmentId) });
    if (!row) {
      return null;
    }
    const events = await this.db
      .select()
      .from(shipmentEvent)
      .where(eq(shipmentEvent.shipmentId, shipmentId))
      .orderBy(asc(shipmentEvent.occurredAt));
    return this.mapShipment(row, events.map((event) => this.mapShipmentEvent(event)));
  }

  public async applySupplierShipmentUpdate(input: {
    orderId: string;
    status: ShipmentStatus;
    carrier: string | null;
    trackingCode: string | null;
    description: string | null;
    occurredAt: Date;
    orderTransition: { toStatus: OrderStatus; reason: string; actorId: string | null } | null;
  }): Promise<AppliedSupplierShipmentUpdate | null> {
    const result = await this.db.transaction(async (tx) => {
      const current = await tx.query.order.findFirst({ where: eq(orderTable.id, input.orderId) });
      if (!current) {
        return null;
      }
      const existing = await tx.query.shipment.findFirst({
        where: eq(shipment.orderId, input.orderId),
        orderBy: desc(shipment.createdAt),
      });
      let targetId: string;
      if (existing) {
        targetId = existing.id;
        await tx
          .update(shipment)
          .set({
            status: input.status,
            carrier: input.carrier ?? existing.carrier,
            trackingCode: input.trackingCode ?? existing.trackingCode,
            updatedAt: new Date(),
          })
          .where(eq(shipment.id, existing.id));
      } else {
        const [created] = await tx
          .insert(shipment)
          .values({
            id: uuidv7(),
            orderId: input.orderId,
            carrier: input.carrier,
            trackingCode: input.trackingCode,
            status: input.status,
            eta: null,
          })
          .returning();
        if (!created) {
          throw new Error("Failed to create shipment from supplier update");
        }
        targetId = created.id;
      }
      await tx.insert(shipmentEvent).values({
        id: uuidv7(),
        shipmentId: targetId,
        status: input.status,
        description: input.description,
        occurredAt: input.occurredAt,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "orders",
        aggregateId: input.orderId,
        eventType: "ShipmentStatusChanged",
        payload: { orderId: input.orderId, shipmentId: targetId, status: input.status },
      });
      let orderTransition: AppliedSupplierShipmentUpdate["orderTransition"] = null;
      if (input.orderTransition) {
        const transition = canTransitionOrder({
          from: current.status,
          to: input.orderTransition.toStatus,
          reason: input.orderTransition.reason,
          hasShipment: true,
        });
        if (transition.ok) {
          const [updated] = await tx
            .update(orderTable)
            .set({
              status: input.orderTransition.toStatus,
              updatedAt: new Date(),
              version: sql`${orderTable.version} + 1` as unknown as number,
            })
            .where(and(eq(orderTable.id, input.orderId), eq(orderTable.version, current.version)))
            .returning();
          if (!updated) {
            throw new Error("Failed to advance order from supplier shipment");
          }
          await tx.insert(orderStatusEvent).values({
            id: uuidv7(),
            orderId: input.orderId,
            fromStatus: current.status,
            toStatus: input.orderTransition.toStatus,
            reason: input.orderTransition.reason,
            actorId: input.orderTransition.actorId,
          });
          await tx.insert(outboxEvent).values({
            id: uuidv7(),
            aggregateType: "orders",
            aggregateId: input.orderId,
            eventType: "OrderStatusChanged",
            payload: { orderId: input.orderId, fromStatus: current.status, toStatus: input.orderTransition.toStatus },
          });
          orderTransition = { fromStatus: current.status, toStatus: input.orderTransition.toStatus };
        }
      }
      return { shipmentId: targetId, orderTransition };
    });
    if (!result) {
      return null;
    }
    const updatedShipment = await this.getShipmentById(result.shipmentId);
    if (!updatedShipment) {
      throw new Error("Updated shipment could not be loaded");
    }
    return { shipment: updatedShipment, orderTransition: result.orderTransition };
  }

  public async recordSensitiveAccess(input: { orderId: string; action: string }, audit: RequestAuditContext): Promise<void> {
    await this.db.insert(accessLog).values({
      id: uuidv7(),
      actorId: audit.actorId,
      resourceType: "order",
      resourceId: input.orderId,
      action: input.action,
      reason: audit.reason ?? null,
      ip: audit.ip ?? "unknown",
      userAgent: audit.userAgent ?? "unknown",
      requestId: audit.requestId ?? "unknown",
    });
  }

  private async findVariantSnapshot(tx: Tx, variantId: string): Promise<VariantSnapshot | null> {
    const [row] = await tx
      .select({
        variantId: productVariant.id,
        variantTitle: productVariant.title,
        sku: productVariant.sku,
        variantActive: productVariant.isActive,
        productTitle: product.title,
        productStatus: product.status,
        productDeletedAt: product.deletedAt,
      })
      .from(productVariant)
      .innerJoin(product, eq(productVariant.productId, product.id))
      .where(eq(productVariant.id, variantId))
      .limit(1);
    if (!row || !row.variantActive || row.productDeletedAt !== null || row.productStatus === ProductStatus.ARCHIVED || row.productStatus === ProductStatus.DRAFT) {
      return null;
    }
    return {
      variantId: row.variantId,
      productTitleSnapshot: `${row.productTitle} - ${row.variantTitle}`,
      skuSnapshot: row.sku,
    };
  }

  private async nextOrderNumber(tx: Tx, now: Date): Promise<string> {
    const year = now.getUTCFullYear();
    const prefix = `ORD-${year}-`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`order-number:${year}`}))`);
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(orderTable)
      .where(sql`${orderTable.orderNumber} like ${`${prefix}%`}`);
    return formatOrderNumber(year, (row?.count ?? 0) + 1);
  }

  private async listShipments(orderId: string): Promise<ShipmentEntity[]> {
    const rows = await this.db.select().from(shipment).where(eq(shipment.orderId, orderId)).orderBy(asc(shipment.createdAt));
    const shipments: ShipmentEntity[] = [];
    for (const row of rows) {
      const events = await this.db
        .select()
        .from(shipmentEvent)
        .where(eq(shipmentEvent.shipmentId, row.id))
        .orderBy(asc(shipmentEvent.occurredAt));
      shipments.push(this.mapShipment(row, events.map((event) => this.mapShipmentEvent(event))));
    }
    return shipments;
  }

  private orderSelectFields() {
    return {
      id: orderTable.id,
      orderNumber: orderTable.orderNumber,
      customerId: orderTable.customerId,
      status: orderTable.status,
      channel: orderTable.channel,
      currency: orderTable.currency,
      subtotalMinor: orderTable.subtotalMinor,
      shippingMinor: orderTable.shippingMinor,
      discountMinor: orderTable.discountMinor,
      taxMinor: orderTable.taxMinor,
      totalMinor: orderTable.totalMinor,
      shippingMethod: orderTable.shippingMethod,
      shippingAddressId: orderTable.shippingAddressId,
      placedBy: orderTable.placedBy,
      notes: orderTable.notes,
      confirmedAt: orderTable.confirmedAt,
      version: orderTable.version,
      createdAt: orderTable.createdAt,
      updatedAt: orderTable.updatedAt,
    };
  }

  private mapOrder(row: typeof orderTable.$inferSelect): OrderEntity {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      customerId: row.customerId,
      status: row.status,
      channel: row.channel,
      currency: this.currency(row.currency),
      subtotalMinor: row.subtotalMinor,
      shippingMinor: row.shippingMinor,
      discountMinor: row.discountMinor,
      taxMinor: row.taxMinor,
      totalMinor: row.totalMinor,
      shippingMethod: row.shippingMethod,
      shippingAddressId: row.shippingAddressId,
      placedBy: row.placedBy,
      notes: row.notes,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      version: row.version,
    };
  }

  private mapLine(row: typeof orderLine.$inferSelect): OrderLineEntity {
    return {
      id: row.id,
      orderId: row.orderId,
      variantId: row.variantId,
      productTitleSnapshot: row.productTitleSnapshot,
      skuSnapshot: row.skuSnapshot,
      quantity: row.quantity,
      unitPriceMinor: row.unitPriceMinor,
      lineTotalMinor: row.lineTotalMinor,
      supplierCostSnapshotMinor: row.supplierCostSnapshotMinor,
    };
  }

  private mapStatusEvent(row: typeof orderStatusEvent.$inferSelect): OrderStatusEventEntity {
    return {
      id: row.id,
      orderId: row.orderId,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      reason: row.reason,
      actorId: row.actorId,
      createdAt: row.createdAt,
    };
  }

  private mapShipment(row: typeof shipment.$inferSelect, events: ShipmentEventEntity[]): ShipmentEntity {
    return {
      id: row.id,
      orderId: row.orderId,
      carrier: row.carrier,
      trackingCode: row.trackingCode,
      status: row.status,
      eta: row.eta,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      events,
    };
  }

  private mapShipmentEvent(row: typeof shipmentEvent.$inferSelect): ShipmentEventEntity {
    return {
      id: row.id,
      shipmentId: row.shipmentId,
      status: row.status,
      description: row.description,
      occurredAt: row.occurredAt,
    };
  }

  private encodeCursor(row: OrderSummaryEntity): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        totalMinor: row.totalMinor,
      }),
    ).toString("base64url");
  }

  private decodeCursor(cursor: string | undefined): OrderListCursor | null {
    if (!cursor) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      const value = parsed as { createdAt?: unknown; id?: unknown; totalMinor?: unknown };
      if (typeof value.createdAt !== "string" || typeof value.id !== "string" || typeof value.totalMinor !== "number") {
        return null;
      }
      return { createdAt: value.createdAt, id: value.id, totalMinor: value.totalMinor };
    } catch {
      return null;
    }
  }

  private currency(value: string): Currency {
    return value === "USD" ? "USD" : "ARS";
  }
}
