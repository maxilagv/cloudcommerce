import { CustomerTier, OrderChannel, OrderStatus, ShippingMethod, type Actor } from "@cloudcommerce/types";
import { hash } from "argon2";
import { describe, expect, it } from "vitest";
import { StorefrontService } from "../../application/storefront-service.js";
import type {
  ActiveSessionRow,
  CreateAccountRecord,
  CreateSessionRecord,
  CreateStoreAddressRecord,
  CustomerAccountRow,
  CustomerProfileRow,
  StorefrontRepository,
} from "../../application/ports.js";
import type { OrderPricingPort } from "../../../orders/application/order-pricing-port.js";
import type {
  CreateManualOrderRecord,
  CreateManualOrderResult,
  OrderAggregate,
  OrderRepository,
} from "../../../orders/application/order-repository.js";

const context = { ip: "127.0.0.1", userAgent: "vitest", requestId: "req-1" };
const productId = "018f0000-0000-7000-8000-00000000aaaa";
const variantId = "018f0000-0000-7000-8000-00000000bbbb";

class FakeRepository implements StorefrontRepository {
  public accounts = new Map<string, CustomerAccountRow>();
  public profiles = new Map<string, CustomerProfileRow>();
  public sessions = new Map<string, ActiveSessionRow>();
  public addresses: CreateStoreAddressRecord[] = [];

  public async seedAccount(email: string, password: string): Promise<CustomerAccountRow> {
    const account: CustomerAccountRow = {
      id: "018f0000-0000-7000-8000-00000000cccc",
      customerId: "018f0000-0000-7000-8000-00000000dddd",
      email,
      passwordHash: await hash(password, { type: 2 }),
      isActive: true,
    };
    this.accounts.set(email, account);
    this.profiles.set(account.customerId, {
      customerId: account.customerId,
      email,
      firstName: "Maxi",
      lastName: "L",
      displayName: "Maxi L",
      tier: CustomerTier.CloudBase,
      whatsapp: null,
    });
    return account;
  }

  public async findAccountByEmail(email: string): Promise<CustomerAccountRow | null> {
    return this.accounts.get(email) ?? null;
  }

  public async findLinkableCustomerIdByEmail(): Promise<string | null> {
    return null;
  }

  public async createAccount(record: CreateAccountRecord): Promise<CustomerProfileRow> {
    const customerId = record.customerId ?? "018f0000-0000-7000-8000-00000000eeee";
    const account: CustomerAccountRow = {
      id: record.accountId,
      customerId,
      email: record.email,
      passwordHash: record.passwordHash,
      isActive: true,
    };
    this.accounts.set(record.email, account);
    const profile: CustomerProfileRow = {
      customerId,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      displayName: `${record.firstName} ${record.lastName}`,
      tier: CustomerTier.CloudBase,
      whatsapp: record.whatsapp,
    };
    this.profiles.set(customerId, profile);
    return profile;
  }

  public async getProfile(customerId: string): Promise<CustomerProfileRow | null> {
    return this.profiles.get(customerId) ?? null;
  }

  public async touchLastLogin(): Promise<void> {}

  public async createSession(record: CreateSessionRecord): Promise<void> {
    const account = [...this.accounts.values()].find((row) => row.id === record.accountId);
    this.sessions.set(record.sessionTokenHash, {
      sessionId: record.id,
      accountId: record.accountId,
      customerId: account?.customerId ?? "",
      accountActive: true,
      expiresAt: record.expiresAt,
    });
  }

  public async findActiveSessionByTokenHash(tokenHash: string): Promise<ActiveSessionRow | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  public async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  public async createAddress(record: CreateStoreAddressRecord): Promise<string> {
    this.addresses.push(record);
    return "018f0000-0000-7000-8000-00000000ffff";
  }

  public async resolvePurchasableVariant(): Promise<{ variantId: string } | null> {
    return { variantId };
  }
}

const aggregate = (customerId: string): OrderAggregate => ({
  order: {
    id: "018f0000-0000-7000-8000-000000001111",
    orderNumber: "CC-0001",
    customerId,
    status: OrderStatus.PENDING_CONFIRMATION,
    channel: OrderChannel.STORE,
    currency: "ARS",
    subtotalMinor: 100_000,
    shippingMinor: 0,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 100_000,
    shippingMethod: ShippingMethod.PICKUP,
    shippingAddressId: null,
    placedBy: null,
    notes: null,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
  lines: [],
  statusHistory: [],
  shipments: [],
});

class FakeOrders implements OrderRepository {
  public lastRecord: CreateManualOrderRecord | null = null;

  public async createManualOrder(input: CreateManualOrderRecord): Promise<CreateManualOrderResult> {
    this.lastRecord = input;
    return { type: "CREATED", aggregate: aggregate(input.customerId) };
  }

  public async getOrderAggregate(): Promise<OrderAggregate | null> {
    return null;
  }

  public async listOrders(): ReturnType<OrderRepository["listOrders"]> {
    return { rows: [], nextCursor: null };
  }

  public async transitionOrder(): Promise<OrderAggregate | null> {
    return null;
  }

  public async createShipment(): ReturnType<OrderRepository["createShipment"]> {
    return null;
  }

  public async getShipmentById(): ReturnType<OrderRepository["getShipmentById"]> {
    return null;
  }

  public async applySupplierShipmentUpdate(): ReturnType<OrderRepository["applySupplierShipmentUpdate"]> {
    return null;
  }

  public async recordSensitiveAccess(): Promise<void> {}
}

const pricing: OrderPricingPort = {
  getSnapshot: async () => ({
    variantId,
    unitPriceMinor: 50_000,
    supplierCostMinor: null,
    supplierId: null,
    compareAtAmountMinor: null,
    appliedTier: "RETAIL",
    currency: "ARS",
  }),
};

const buildService = (repository = new FakeRepository(), orders = new FakeOrders()) =>
  new StorefrontService(repository, orders, pricing);

describe("StorefrontService", () => {
  it("registra una cuenta, emite sesion y la resuelve como actor customer", async () => {
    const repository = new FakeRepository();
    const service = buildService(repository);
    const result = await service.register(
      { email: "maxi@test.com", password: "supersegura1", firstName: "Maxi", lastName: "L" },
      context,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.profile.displayName).toBe("Maxi L");
    const resolved = await service.resolveSession(result.value.sessionToken);
    expect(resolved?.actor.kind).toBe("customer");
  });

  it("rechaza el registro con email duplicado", async () => {
    const repository = new FakeRepository();
    await repository.seedAccount("maxi@test.com", "supersegura1");
    const service = buildService(repository);
    const result = await service.register(
      { email: "maxi@test.com", password: "otraclave123", firstName: "Otro", lastName: "User" },
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("EMAIL_IN_USE");
  });

  it("login con credenciales invalidas falla sin filtrar el motivo", async () => {
    const repository = new FakeRepository();
    await repository.seedAccount("maxi@test.com", "supersegura1");
    const service = buildService(repository);
    const wrongPassword = await service.login({ email: "maxi@test.com", password: "incorrecta1" }, context);
    const wrongEmail = await service.login({ email: "nadie@test.com", password: "incorrecta1" }, context);
    expect(wrongPassword.ok).toBe(false);
    expect(wrongEmail.ok).toBe(false);
    if (!wrongPassword.ok) expect(wrongPassword.error.type).toBe("INVALID_CREDENTIALS");
    if (!wrongEmail.ok) expect(wrongEmail.error.type).toBe("INVALID_CREDENTIALS");
  });

  it("checkout exige actor customer", async () => {
    const service = buildService();
    const publicActor: Actor = { kind: "public" };
    const result = await service.checkout(
      publicActor,
      { items: [{ productId, quantity: 1 }], shippingMethod: ShippingMethod.PICKUP },
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("UNAUTHENTICATED");
  });

  it("checkout de cliente crea la orden canal STORE en PENDING_CONFIRMATION", async () => {
    const orders = new FakeOrders();
    const service = buildService(new FakeRepository(), orders);
    const customerActor: Actor = { kind: "customer", customerId: "018f0000-0000-7000-8000-00000000dddd" };
    const result = await service.checkout(
      customerActor,
      { items: [{ productId, quantity: 2 }], shippingMethod: ShippingMethod.PICKUP },
      context,
    );
    expect(result.ok).toBe(true);
    expect(orders.lastRecord?.channel).toBe(OrderChannel.STORE);
    expect(orders.lastRecord?.initialStatus).toBe(OrderStatus.PENDING_CONFIRMATION);
    expect(orders.lastRecord?.placedBy).toBeNull();
    expect(orders.lastRecord?.lines[0]?.quantity).toBe(2);
  });

  it("checkout con envio a domicilio sin direccion falla", async () => {
    const service = buildService();
    const customerActor: Actor = { kind: "customer", customerId: "018f0000-0000-7000-8000-00000000dddd" };
    const result = await service.checkout(
      customerActor,
      { items: [{ productId, quantity: 1 }], shippingMethod: ShippingMethod.STANDARD },
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("ADDRESS_REQUIRED");
  });
});
