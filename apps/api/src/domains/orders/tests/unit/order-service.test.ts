import { AdminRole, OrderChannel, OrderStatus, ShipmentStatus, ShippingMethod, type Actor, type Currency } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import type { OrderPricingPort } from "../../application/order-pricing-port.js";
import type {
  CreateManualOrderRecord,
  CreateManualOrderResult,
  ListOrdersQuery,
  OrderAggregate,
  OrderRepository,
  OrderSummaryEntity,
  RequestAuditContext,
  ShipmentEntity,
} from "../../application/order-repository.js";
import { OrderService } from "../../application/order-service.js";

const now = new Date("2026-07-01T12:00:00.000Z");
const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const customerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const variantId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

describe("OrderService", () => {
  it("creates manual orders idempotently and recalculates totals in the backend", async () => {
    const repository = new FakeOrderRepository();
    const service = newService(repository);
    const input = manualOrderInput();

    const first = await service.createManualOrder(admin(AdminRole.SUPPORT), input, { ...requestContext, idempotencyKey: "idem-1" });
    const second = await service.createManualOrder(admin(AdminRole.SUPPORT), input, { ...requestContext, idempotencyKey: "idem-1" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(repository.createdCount).toBe(1);
    expect(repository.lastCreate?.lines[0]?.unitPriceMinor).toBe(100_000);
    if (first.ok && second.ok) {
      expect(first.value.id).toBe(second.value.id);
      expect(first.value.total.amountMinor).toBe(224_900);
    }
  });

  it("returns IDEMPOTENCY_CONFLICT when the same key is reused with a different payload", async () => {
    const repository = new FakeOrderRepository();
    const service = newService(repository);

    await service.createManualOrder(admin(AdminRole.ADMIN), manualOrderInput(), { ...requestContext, idempotencyKey: "idem-2" });
    const conflict = await service.createManualOrder(
      admin(AdminRole.ADMIN),
      { ...manualOrderInput(), notes: "payload distinto" },
      { ...requestContext, idempotencyKey: "idem-2" },
    );

    expect(conflict.ok).toBe(false);
    if (!conflict.ok) {
      expect(conflict.error.type).toBe("IDEMPOTENCY_CONFLICT");
    }
  });

  it("surfaces insufficient stock from the repository", async () => {
    const repository = new FakeOrderRepository({ insufficientStock: true });
    const service = newService(repository);

    const result = await service.createManualOrder(admin(AdminRole.ADMIN), manualOrderInput(), requestContext);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INSUFFICIENT_STOCK");
    }
  });

  it("hides supplier cost and margin from SUPPORT", async () => {
    const service = newService(new FakeOrderRepository());

    const result = await service.getDetail(
      admin(AdminRole.SUPPORT),
      { orderId, reason: "Atender consulta del cliente" },
      requestContext,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.costVisible).toBe(false);
      expect("supplierCost" in (result.value.lines[0] ?? {})).toBe(false);
      expect("totalMargin" in result.value).toBe(false);
    }
  });

  it("exposes supplier cost only to finance-capable roles", async () => {
    const service = newService(new FakeOrderRepository());

    const result = await service.getDetail(admin(AdminRole.FINANCE), { orderId }, requestContext);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.costVisible).toBe(true);
      expect(result.value.lines[0]?.supplierCost?.amountMinor).toBe(60_000);
      expect(result.value.totalMargin?.amountMinor).toBe(80_000);
    }
  });

  it("rejects catalog managers from order detail access", async () => {
    const service = newService(new FakeOrderRepository());

    const result = await service.getDetail(admin(AdminRole.CATALOG_MANAGER), { orderId }, requestContext);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });

  it("only allows one concurrent transition from the same stale state", async () => {
    const repository = new FakeOrderRepository({ transitionDelayMs: 10 });
    const service = newService(repository);
    const actor = admin(AdminRole.ADMIN);

    const [first, second] = await Promise.all([
      service.transition(actor, { orderId, toStatus: OrderStatus.PREPARING }),
      service.transition(actor, { orderId, toStatus: OrderStatus.PREPARING }),
    ]);

    const successes = [first, second].filter((result) => result.ok);
    const failures = [first, second].filter((result) => !result.ok);
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    expect(repository.current.order.status).toBe(OrderStatus.PREPARING);
    expect(repository.transitionCalls).toBe(2);
    const failed = failures[0];
    if (failed?.ok === false) {
      expect(failed.error.type).toBe("INVALID_ORDER_STATE");
    }
  });

  it("advances order status when a supplier shipment is delivered", async () => {
    const repository = new FakeOrderRepository({
      current: aggregate({
        status: OrderStatus.SHIPPED,
      }, [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          orderId,
          carrier: "OCA",
          trackingCode: "TRACK",
          status: ShipmentStatus.IN_TRANSIT,
          eta: null,
          createdAt: now,
          updatedAt: now,
          events: [],
        },
      ]),
    });
    const service = newService(repository);

    const result = await service.applySupplierShipmentUpdate(system, {
      orderId,
      status: ShipmentStatus.DELIVERED,
      occurredAt: now,
    });

    expect(result.ok).toBe(true);
    expect(repository.current.order.status).toBe(OrderStatus.DELIVERED);
  });
});

const newService = (repository: OrderRepository): OrderService => new OrderService(repository, new FakePricingPort());

const manualOrderInput = () => ({
  customerId,
  shippingMethod: ShippingMethod.EXPRESS,
  shippingAddressId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
  lines: [{ variantId, quantity: 2 }],
});

const admin = (role: AdminRole): Actor => ({
  kind: "admin",
  userId: "admin-user",
  role,
  sessionId: "session",
});

const system: Actor = { kind: "system", service: "supplier-webhook" };

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "request-id",
};

class FakePricingPort implements OrderPricingPort {
  public async getSnapshot(): Promise<{ variantId: string; unitPriceMinor: number; supplierCostMinor: number; compareAtAmountMinor: null; currency: Currency }> {
    return {
      variantId,
      unitPriceMinor: 100_000,
      supplierCostMinor: 60_000,
      compareAtAmountMinor: null,
      currency: "ARS",
    };
  }
}

class FakeOrderRepository implements OrderRepository {
  public createdCount = 0;
  public lastCreate: CreateManualOrderRecord | null = null;
  public current: OrderAggregate;
  public transitionCalls = 0;
  private readonly idempotency = new Map<string, { requestHash: string; aggregate: OrderAggregate }>();

  public constructor(private readonly options: { insufficientStock?: boolean; transitionDelayMs?: number; current?: OrderAggregate } = {}) {
    this.current = options.current ?? aggregate();
  }

  public async createManualOrder(input: CreateManualOrderRecord): Promise<CreateManualOrderResult> {
    this.lastCreate = input;
    if (this.options.insufficientStock) {
      return { type: "INSUFFICIENT_STOCK", variantId };
    }
    if (input.idempotencyKey) {
      const existing = this.idempotency.get(input.idempotencyKey);
      if (existing) {
        return existing.requestHash === input.requestHash
          ? { type: "REUSED", aggregate: existing.aggregate }
          : { type: "IDEMPOTENCY_CONFLICT" };
      }
    }
    this.createdCount += 1;
    const aggregate = aggregateFromCreate(input);
    if (input.idempotencyKey) {
      this.idempotency.set(input.idempotencyKey, { requestHash: input.requestHash, aggregate });
    }
    return { type: "CREATED", aggregate };
  }

  public async getOrderAggregate(id: string): Promise<OrderAggregate | null> {
    return id === orderId ? cloneAggregate(this.current) : null;
  }

  public async listOrders(): Promise<{ rows: OrderSummaryEntity[]; nextCursor: string | null }> {
    return { rows: [{ ...this.current.order, itemCount: 2 }], nextCursor: null };
  }

  public async transitionOrder(input: {
    orderId: string;
    toStatus: OrderStatus;
    reason: string | null;
    actorId: string | null;
  }): Promise<OrderAggregate | null> {
    this.transitionCalls += 1;
    if (this.options.transitionDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.transitionDelayMs));
    }
    if (this.current.order.status !== OrderStatus.CONFIRMED && input.toStatus === OrderStatus.PREPARING) {
      return null;
    }
    this.current = aggregate({ status: input.toStatus, version: this.current.order.version + 1 }, this.current.shipments);
    return cloneAggregate(this.current);
  }

  public async createShipment(): Promise<ShipmentEntity | null> {
    return {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      orderId,
      carrier: "demo",
      trackingCode: "TRACK",
      status: ShipmentStatus.CREATED,
      eta: null,
      createdAt: now,
      updatedAt: now,
      events: [],
    };
  }

  public async getShipmentById(): Promise<ShipmentEntity | null> {
    return null;
  }

  public async applySupplierShipmentUpdate(input: {
    orderId: string;
    status: ShipmentStatus;
    carrier: string | null;
    trackingCode: string | null;
    description: string | null;
    occurredAt: Date;
  }): Promise<ShipmentEntity | null> {
    const updatedShipment = {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
      orderId: input.orderId,
      carrier: input.carrier,
      trackingCode: input.trackingCode,
      status: input.status,
      eta: null,
      createdAt: now,
      updatedAt: now,
      events: [],
    };
    this.current = aggregate(this.current.order, [updatedShipment]);
    return updatedShipment;
  }

  public async recordSensitiveAccess(_input: { orderId: string; action: string }, _audit: RequestAuditContext): Promise<void> {}
}

const aggregateFromCreate = (input: CreateManualOrderRecord): OrderAggregate => {
  const subtotal = input.lines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  return aggregate({ subtotalMinor: subtotal, shippingMinor: input.shippingMinor, totalMinor: subtotal + input.shippingMinor });
};

const aggregate = (override: Partial<OrderAggregate["order"]> = {}, shipments: ShipmentEntity[] = []): OrderAggregate => ({
  order: {
    id: orderId,
    orderNumber: "ORD-2026-000001",
    customerId,
    status: OrderStatus.CONFIRMED,
    channel: OrderChannel.ADMIN_MANUAL,
    currency: "ARS",
    subtotalMinor: 200_000,
    shippingMinor: 24_900,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 224_900,
    shippingMethod: ShippingMethod.EXPRESS,
    shippingAddressId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    placedBy: "admin-user",
    notes: null,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...override,
  },
  lines: [
    {
      id: "ffffffff-ffff-4fff-8fff-fffffffffff1",
      orderId,
      variantId,
      productTitleSnapshot: "Smartphone Demo - Negro",
      skuSnapshot: "DEMO",
      quantity: 2,
      unitPriceMinor: 100_000,
      lineTotalMinor: 200_000,
      supplierCostSnapshotMinor: 60_000,
    },
  ],
  statusHistory: [],
  shipments,
});

const cloneAggregate = (value: OrderAggregate): OrderAggregate => ({
  order: { ...value.order },
  lines: value.lines.map((line) => ({ ...line })),
  statusHistory: value.statusHistory.map((event) => ({ ...event })),
  shipments: value.shipments.map((shipment) => ({
    ...shipment,
    events: shipment.events.map((event) => ({ ...event })),
  })),
});
