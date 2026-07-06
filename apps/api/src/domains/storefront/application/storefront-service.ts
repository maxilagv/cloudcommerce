import {
  OrderChannel,
  OrderStatus,
  ShippingMethod,
  type Actor,
  type Currency,
  type Money,
  type StoreAuthResult,
  type StoreCheckoutResult,
  type StoreCustomerProfile,
  type StoreOrderDetail,
  type StoreOrderListResult,
} from "@cloudcommerce/types";
import type {
  StoreCheckoutInput,
  StoreLoginInput,
  StoreMyOrdersInput,
  StoreOrderDetailInput,
  StoreRegisterInput,
} from "@cloudcommerce/validators";
import { hash, verify } from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { StorefrontDomainError } from "../../../shared/errors/domain-error.js";
import type { InMemoryEventBus } from "../../../shared/events/event-bus.js";
import type { OrderPricingPort } from "../../orders/application/order-pricing-port.js";
import type {
  CreateManualOrderLineRecord,
  OrderAggregate,
  OrderRepository,
} from "../../orders/application/order-repository.js";
import type { CustomerProfileRow, StorefrontRepository } from "./ports.js";

const SESSION_TTL_DAYS = 30;
const CURRENCY: Currency = "ARS";

export type StorefrontRequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
};

export type StoreSessionIssued = StoreAuthResult & {
  /** Token en claro para setear la cookie httpOnly; nunca viaja en el body. */
  sessionToken: string;
};

/**
 * Servicio del storefront público: registro/login de clientes, sesiones por
 * cookie propia (cc_customer_session), checkout canal STORE y "mis pedidos".
 * Nunca expone costos de proveedor ni datos de otros clientes.
 */
export class StorefrontService {
  public constructor(
    private readonly repository: StorefrontRepository,
    private readonly orders: OrderRepository,
    private readonly pricing: OrderPricingPort,
    private readonly eventBus?: InMemoryEventBus,
  ) {}

  public async register(
    input: StoreRegisterInput,
    context: StorefrontRequestContext,
  ): Promise<Result<StoreSessionIssued, StorefrontDomainError>> {
    const existing = await this.repository.findAccountByEmail(input.email);
    if (existing) {
      return err({ type: "EMAIL_IN_USE" });
    }
    // Si el CRM ya conoce ese email (cliente creado por el admin o por un
    // pedido manual), la cuenta nueva se vincula a ese cliente.
    const linkableCustomerId = await this.repository.findLinkableCustomerIdByEmail(input.email);
    const profile = await this.repository.createAccount({
      accountId: uuidv7(),
      customerId: linkableCustomerId,
      email: input.email,
      passwordHash: await hash(input.password, { type: 2 }),
      firstName: input.firstName,
      lastName: input.lastName,
      whatsapp: input.whatsapp ?? null,
    });
    return this.issueSession(profile, context);
  }

  public async login(
    input: StoreLoginInput,
    context: StorefrontRequestContext,
  ): Promise<Result<StoreSessionIssued, StorefrontDomainError>> {
    const account = await this.repository.findAccountByEmail(input.email);
    if (!account) {
      // Verificación fantasma para igualar el tiempo de respuesta.
      await verify(PHANTOM_HASH, input.password).catch(() => false);
      return err({ type: "INVALID_CREDENTIALS" });
    }
    const valid = await verify(account.passwordHash, input.password).catch(() => false);
    if (!valid) {
      return err({ type: "INVALID_CREDENTIALS" });
    }
    if (!account.isActive) {
      return err({ type: "ACCOUNT_INACTIVE" });
    }
    const profile = await this.repository.getProfile(account.customerId);
    if (!profile) {
      return err({ type: "INVALID_CREDENTIALS" });
    }
    await this.repository.touchLastLogin(account.id);
    return this.issueSession(profile, context);
  }

  public async logout(sessionToken: string | undefined): Promise<Result<{ loggedOut: boolean }, StorefrontDomainError>> {
    if (sessionToken) {
      await this.repository.revokeSessionByTokenHash(hashToken(sessionToken));
    }
    return ok({ loggedOut: true });
  }

  /** Usado por el contexto tRPC para resolver el actor customer. */
  public async resolveSession(
    sessionToken: string | undefined,
  ): Promise<{ actor: Extract<Actor, { kind: "customer" }>; profile: StoreCustomerProfile } | null> {
    if (!sessionToken) {
      return null;
    }
    const session = await this.repository.findActiveSessionByTokenHash(hashToken(sessionToken));
    if (!session || !session.accountActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    const profile = await this.repository.getProfile(session.customerId);
    if (!profile) {
      return null;
    }
    return { actor: { kind: "customer", customerId: session.customerId }, profile: presentProfile(profile) };
  }

  public async me(actor: Actor): Promise<Result<StoreCustomerProfile, StorefrontDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const profile = await this.repository.getProfile(actor.customerId);
    if (!profile) {
      return err({ type: "UNAUTHENTICATED" });
    }
    return ok(presentProfile(profile));
  }

  public async checkout(
    actor: Actor,
    input: StoreCheckoutInput,
    context: StorefrontRequestContext,
  ): Promise<Result<StoreCheckoutResult, StorefrontDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    if (input.shippingMethod !== ShippingMethod.PICKUP && !input.address) {
      return err({ type: "ADDRESS_REQUIRED" });
    }

    // Resuelve variantes comprables y precios vigentes; agrupa duplicados.
    const productByVariant = new Map<string, string>();
    const quantities = new Map<string, number>();
    for (const item of input.items) {
      const resolved = await this.repository.resolvePurchasableVariant(item.productId, item.variantId ?? null);
      if (!resolved) {
        return err({ type: "PRODUCT_NOT_AVAILABLE", productId: item.productId });
      }
      productByVariant.set(resolved.variantId, item.productId);
      quantities.set(resolved.variantId, (quantities.get(resolved.variantId) ?? 0) + item.quantity);
    }
    const lines: CreateManualOrderLineRecord[] = [];
    for (const [variantId, quantity] of quantities) {
      // La cantidad viaja al pricing: decide el tramo minorista/mayorista.
      const snapshot = await this.pricing.getSnapshot({ variantId, currency: CURRENCY, quantity });
      if (!snapshot) {
        return err({ type: "PRICING_UNAVAILABLE", productId: productByVariant.get(variantId) ?? variantId });
      }
      lines.push({
        variantId,
        quantity,
        unitPriceMinor: snapshot.unitPriceMinor,
        supplierCostSnapshotMinor: snapshot.supplierCostMinor,
        supplierId: snapshot.supplierId,
      });
    }

    let shippingAddressId: string | null = null;
    if (input.shippingMethod !== ShippingMethod.PICKUP && input.address) {
      shippingAddressId = await this.repository.createAddress({
        customerId: actor.customerId,
        recipientName: input.address.recipientName ?? null,
        province: input.address.province,
        city: input.address.city,
        street: input.address.street,
        streetNumber: input.address.streetNumber ?? null,
        postalCode: input.address.postalCode ?? null,
      });
    }

    const result = await this.orders.createManualOrder(
      {
        idempotencyKey: input.idempotencyKey ?? null,
        requestHash: hashPayload({ ...input, customerId: actor.customerId }),
        customerId: actor.customerId,
        channel: OrderChannel.STORE,
        statusReason: "Pedido creado desde la tienda",
        shippingMethod: input.shippingMethod,
        shippingAddressId,
        initialStatus: OrderStatus.PENDING_CONFIRMATION,
        currency: CURRENCY,
        shippingMinor: shippingAmount(input.shippingMethod),
        discountMinor: 0,
        taxMinor: 0,
        notes: input.notes ?? null,
        placedBy: null,
        lines,
      },
      {
        actorId: null,
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId,
        reason: "store.checkout",
      },
    );

    switch (result.type) {
      case "CREATED":
        await this.eventBus?.publish({
          id: uuidv7(),
          type: "OrderCreated",
          aggregateType: "orders",
          aggregateId: result.aggregate.order.id,
          occurredAt: new Date(),
          payload: {
            orderId: result.aggregate.order.id,
            orderNumber: result.aggregate.order.orderNumber,
            status: result.aggregate.order.status,
          },
        });
        return ok(presentCheckout(result.aggregate));
      case "REUSED":
        return ok(presentCheckout(result.aggregate));
      case "IDEMPOTENCY_CONFLICT":
        return err({ type: "IDEMPOTENCY_CONFLICT" });
      case "CUSTOMER_NOT_FOUND":
        return err({ type: "UNAUTHENTICATED" });
      case "ADDRESS_NOT_DELIVERABLE":
        return err({ type: "ADDRESS_REQUIRED" });
      case "PRODUCT_NOT_AVAILABLE":
        return err({ type: "PRODUCT_NOT_AVAILABLE", productId: productByVariant.get(result.variantId) ?? result.variantId });
      case "INSUFFICIENT_STOCK":
        return err({ type: "INSUFFICIENT_STOCK", productId: productByVariant.get(result.variantId) ?? result.variantId });
    }
  }

  public async myOrders(actor: Actor, input: StoreMyOrdersInput): Promise<Result<StoreOrderListResult, StorefrontDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const page = await this.orders.listOrders({
      customerId: actor.customerId,
      sort: "newest",
      limit: input.limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    });
    return ok({
      items: page.rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        shippingMethod: row.shippingMethod,
        itemCount: row.itemCount,
        total: money(row.totalMinor, row.currency),
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    });
  }

  public async orderDetail(actor: Actor, input: StoreOrderDetailInput): Promise<Result<StoreOrderDetail, StorefrontDomainError>> {
    if (actor.kind !== "customer") {
      return err({ type: "UNAUTHENTICATED" });
    }
    const aggregate = await this.orders.getOrderAggregate(input.orderId);
    // Un pedido ajeno responde igual que uno inexistente: no filtra información.
    if (!aggregate || aggregate.order.customerId !== actor.customerId) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    return ok(presentOrderDetail(aggregate));
  }

  private async issueSession(
    profile: CustomerProfileRow,
    context: StorefrontRequestContext,
  ): Promise<Result<StoreSessionIssued, StorefrontDomainError>> {
    const account = await this.repository.findAccountByEmail(profile.email);
    if (!account) {
      return err({ type: "INVALID_CREDENTIALS" });
    }
    const sessionToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.repository.createSession({
      id: uuidv7(),
      accountId: account.id,
      sessionTokenHash: hashToken(sessionToken),
      ip: context.ip,
      userAgent: context.userAgent.slice(0, 300),
      expiresAt,
    });
    return ok({
      profile: presentProfile(profile),
      expiresAt: expiresAt.toISOString(),
      sessionToken,
    });
  }
}

/** Hash argon2 de un password imposible: iguala tiempos cuando el email no existe. */
const PHANTOM_HASH = "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$JZk1IcezotFTDcwEG1TVsjjB5G1DXZo1P9pFLLDdOJs";

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const hashPayload = (payload: unknown): string => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

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

const presentProfile = (row: CustomerProfileRow): StoreCustomerProfile => ({
  customerId: row.customerId,
  email: row.email,
  firstName: row.firstName,
  lastName: row.lastName,
  displayName: row.displayName,
  tier: row.tier,
  whatsapp: row.whatsapp,
});

const presentCheckout = (aggregate: OrderAggregate): StoreCheckoutResult => ({
  orderId: aggregate.order.id,
  orderNumber: aggregate.order.orderNumber,
  status: aggregate.order.status,
  total: money(aggregate.order.totalMinor, aggregate.order.currency),
});

const presentOrderDetail = (aggregate: OrderAggregate): StoreOrderDetail => ({
  id: aggregate.order.id,
  orderNumber: aggregate.order.orderNumber,
  status: aggregate.order.status,
  shippingMethod: aggregate.order.shippingMethod,
  itemCount: aggregate.lines.reduce((sum, line) => sum + line.quantity, 0),
  total: money(aggregate.order.totalMinor, aggregate.order.currency),
  createdAt: aggregate.order.createdAt.toISOString(),
  subtotal: money(aggregate.order.subtotalMinor, aggregate.order.currency),
  shipping: money(aggregate.order.shippingMinor, aggregate.order.currency),
  discount: money(aggregate.order.discountMinor, aggregate.order.currency),
  tax: money(aggregate.order.taxMinor, aggregate.order.currency),
  notes: aggregate.order.notes,
  lines: aggregate.lines.map((line) => ({
    title: line.productTitleSnapshot,
    sku: line.skuSnapshot,
    quantity: line.quantity,
    unitPrice: money(line.unitPriceMinor, aggregate.order.currency),
    lineTotal: money(line.lineTotalMinor, aggregate.order.currency),
  })),
  shipments: aggregate.shipments.map((shipment) => ({
    carrier: shipment.carrier,
    trackingCode: shipment.trackingCode,
    status: shipment.status,
    eta: shipment.eta?.toISOString() ?? null,
  })),
  statusHistory: aggregate.statusHistory.map((event) => ({
    status: event.toStatus,
    at: event.createdAt.toISOString(),
  })),
});
