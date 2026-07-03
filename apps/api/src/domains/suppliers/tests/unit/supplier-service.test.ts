import {
  AdminRole,
  SupplierFeedKind,
  SupplierFeedStatus,
  SupplierForwardStatus,
  SupplierSyncStatus,
  type Actor,
  type SupplierFeedRecord,
  type SupplierOrderRefRecord,
  type SupplierProductMapRecord,
  type SupplierSummary,
} from "@cloudcommerce/types";
import type { SupplierApiConfigInput } from "@cloudcommerce/validators";
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SupplierService } from "../../application/supplier-service.js";
import type {
  ApiConfigCipherPort,
  CreateSupplierRecord,
  FeedFetcherPort,
  FeedLockPort,
  ForwardableOrder,
  InventoryImportPort,
  OrdersIntegrationPort,
  PricingImportPort,
  SupplierEntity,
  SupplierForwarderPort,
  SupplierRepository,
  UpsertFeedRecord,
  UpsertMapRowRecord,
  UrlGuardPort,
} from "../../application/ports.js";

const owner: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000001", role: AdminRole.OWNER, sessionId: "s1" };
const support: Actor = { kind: "admin", userId: "018f0000-0000-7000-8000-000000000002", role: AdminRole.SUPPORT, sessionId: "s2" };
const system: Actor = { kind: "system", service: "worker" };

const supplierId = "018f0000-0000-7000-8000-0000000000s1".replace("s1", "a1");
const feedId = "018f0000-0000-7000-8000-0000000000f1".replace("f1", "b1");
const variantId = "018f0000-0000-7000-8000-0000000000c1";
const orderId = "018f0000-0000-7000-8000-0000000000d1";

class FakeCipher implements ApiConfigCipherPort {
  public encrypt(config: SupplierApiConfigInput): string {
    return `enc:${JSON.stringify(config)}`;
  }

  public decrypt(payload: string): SupplierApiConfigInput | null {
    if (!payload.startsWith("enc:")) return null;
    return JSON.parse(payload.slice(4)) as SupplierApiConfigInput;
  }
}

class FakeUrlGuard implements UrlGuardPort {
  public calls: string[] = [];

  public constructor(
    private readonly blocked: boolean = false,
    private readonly resolvedIp = "203.0.113.10",
  ) {}

  public async validate(url: string): ReturnType<UrlGuardPort["validate"]> {
    this.calls.push(url);
    return this.blocked ? { allowed: false, reason: "ip_privada" } : { allowed: true, resolvedIp: this.resolvedIp };
  }
}

class FakeFetcher implements FeedFetcherPort {
  public inputs: Array<{ sourceUrl: string; resolvedIp: string }> = [];

  public constructor(
    private readonly rows: Array<Record<string, unknown>> | null,
  ) {}

  public async fetchRows(input: { sourceUrl: string; resolvedIp: string }): ReturnType<FeedFetcherPort["fetchRows"]> {
    this.inputs.push(input);
    if (this.rows === null) {
      return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    }
    return { ok: true, value: this.rows };
  }
}

class FakeForwarder implements SupplierForwarderPort {
  public calls = 0;
  public inputs: Array<{ resolvedIp: string }> = [];

  public constructor(private readonly mode: "accept" | "reject" | "down" = "accept") {}

  public async forwardOrder(input: { resolvedIp: string }): ReturnType<SupplierForwarderPort["forwardOrder"]> {
    this.calls += 1;
    this.inputs.push(input);
    if (this.mode === "down") return { ok: false, error: { type: "UPSTREAM_UNAVAILABLE" } };
    if (this.mode === "reject") return { ok: true, value: { accepted: false, reason: "sin stock" } };
    return { ok: true, value: { accepted: true, externalOrderId: "EXT-001" } };
  }
}

class FakeLock implements FeedLockPort {
  public constructor(private readonly available: boolean = true) {}

  public async acquire(): Promise<boolean> {
    return this.available;
  }

  public async release(): Promise<void> {}
}

class FakePricingImport implements PricingImportPort {
  public calls: Array<{ variantId: string; costAmountMinor: number }> = [];

  public async applySupplierCost(input: { variantId: string; supplierId: string; costAmountMinor: number }): Promise<boolean> {
    this.calls.push({ variantId: input.variantId, costAmountMinor: input.costAmountMinor });
    return true;
  }
}

class FakeInventoryImport implements InventoryImportPort {
  public calls: Array<{ variantId: string; stock: number }> = [];

  public async applyStockLevel(input: { variantId: string; stock: number }): Promise<boolean> {
    this.calls.push({ variantId: input.variantId, stock: input.stock });
    return true;
  }
}

class FakeOrders implements OrdersIntegrationPort {
  public shipmentUpdates: Array<{ orderId: string; status: string }> = [];

  public constructor(private readonly order: ForwardableOrder | null) {}

  public async getForwardableOrder(): Promise<ForwardableOrder | null> {
    return this.order;
  }

  public async applyShipmentUpdate(input: { orderId: string; status: string }): Promise<boolean> {
    this.shipmentUpdates.push({ orderId: input.orderId, status: input.status });
    return true;
  }
}

class FakeRepository implements SupplierRepository {
  public suppliers = new Map<string, SupplierEntity>();
  public feeds = new Map<string, SupplierFeedRecord>();
  public maps = new Map<string, SupplierProductMapRecord & { contentHash: string | null; raw: Record<string, unknown> }>();
  public orderRefs = new Map<string, SupplierOrderRefRecord>();
  public webhookEvents = new Set<string>();
  public outbox: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  public feedRunResults: Array<{ status: SupplierFeedStatus }> = [];

  public async listSuppliers(input: { limit: number }): ReturnType<SupplierRepository["listSuppliers"]> {
    return { items: [...this.suppliers.values()].slice(0, input.limit), nextCursor: null };
  }

  public async findSupplierById(id: string): Promise<SupplierEntity | null> {
    return this.suppliers.get(id) ?? null;
  }

  public async findSupplierBySlug(slug: string): Promise<SupplierEntity | null> {
    return [...this.suppliers.values()].find((candidate) => candidate.slug === slug) ?? null;
  }

  public async createSupplier(record: CreateSupplierRecord): Promise<SupplierSummary> {
    const entity: SupplierEntity = {
      id: record.id,
      name: record.name,
      slug: record.slug,
      contact: record.contact,
      isActive: true,
      hasApiConfig: record.apiConfigEnc !== null,
      apiConfigEnc: record.apiConfigEnc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.suppliers.set(record.id, entity);
    return entity;
  }

  public async updateSupplier(input: { id: string; name?: string | undefined }): Promise<SupplierSummary | null> {
    const existing = this.suppliers.get(input.id);
    if (!existing) return null;
    if (input.name !== undefined) existing.name = input.name;
    return existing;
  }

  public async setSupplierActive(id: string, isActive: boolean): Promise<SupplierSummary | null> {
    const existing = this.suppliers.get(id);
    if (!existing) return null;
    existing.isActive = isActive;
    return existing;
  }

  public async setSupplierApiConfig(id: string, apiConfigEnc: string): Promise<SupplierSummary | null> {
    const existing = this.suppliers.get(id);
    if (!existing) return null;
    existing.apiConfigEnc = apiConfigEnc;
    existing.hasApiConfig = true;
    return existing;
  }

  public async listFeeds(target: string): Promise<SupplierFeedRecord[]> {
    return [...this.feeds.values()].filter((feed) => feed.supplierId === target);
  }

  public async findFeedById(target: string): Promise<SupplierFeedRecord | null> {
    return this.feeds.get(target) ?? null;
  }

  public async upsertFeed(record: UpsertFeedRecord): Promise<SupplierFeedRecord> {
    const feed: SupplierFeedRecord = {
      id: record.id,
      supplierId: record.supplierId,
      kind: record.kind,
      sourceUrl: record.sourceUrl,
      schedule: record.schedule,
      fieldMap: record.fieldMap,
      status: SupplierFeedStatus.IDLE,
      lastRunAt: null,
      lastRunSummary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.feeds.set(record.id, feed);
    return feed;
  }

  public async setFeedRunResult(input: { feedId: string; status: SupplierFeedStatus }): Promise<void> {
    const feed = this.feeds.get(input.feedId);
    if (feed) feed.status = input.status;
    this.feedRunResults.push({ status: input.status });
  }

  public async setFeedStatus(target: string, status: SupplierFeedStatus): Promise<void> {
    const feed = this.feeds.get(target);
    if (feed) feed.status = status;
  }

  public async listMap(input: { supplierId: string; limit: number }): ReturnType<SupplierRepository["listMap"]> {
    return {
      items: [...this.maps.values()].filter((map) => map.supplierId === input.supplierId).slice(0, input.limit),
      nextCursor: null,
    };
  }

  public async findMapById(mapId: string): Promise<SupplierProductMapRecord | null> {
    return this.maps.get(mapId) ?? null;
  }

  public async findMapByExternalId(target: string, externalId: string): ReturnType<SupplierRepository["findMapByExternalId"]> {
    return [...this.maps.values()].find((map) => map.supplierId === target && map.externalId === externalId) ?? null;
  }

  public async findMapByVariantId(target: string, targetVariantId: string): Promise<SupplierProductMapRecord | null> {
    return [...this.maps.values()].find((map) => map.supplierId === target && map.variantId === targetVariantId) ?? null;
  }

  public async findMapsByVariantIds(variantIds: string[]): Promise<SupplierProductMapRecord[]> {
    return [...this.maps.values()].filter((map) => map.variantId !== null && variantIds.includes(map.variantId));
  }

  public async upsertMapRow(record: UpsertMapRowRecord): Promise<void> {
    const existing = [...this.maps.values()].find(
      (map) => map.supplierId === record.supplierId && map.externalId === record.externalId,
    );
    if (existing) {
      existing.raw = record.raw;
      existing.contentHash = record.contentHash;
      existing.syncStatus = record.syncStatus;
      existing.lastSeenAt = record.seenAt.toISOString();
      if (record.synced) existing.syncedAt = record.seenAt.toISOString();
      return;
    }
    this.maps.set(record.id, {
      id: record.id,
      supplierId: record.supplierId,
      externalId: record.externalId,
      variantId: null,
      raw: record.raw,
      contentHash: record.contentHash,
      syncStatus: record.syncStatus,
      lastSeenAt: record.seenAt.toISOString(),
      syncedAt: record.synced ? record.seenAt.toISOString() : null,
      createdAt: new Date().toISOString(),
    });
  }

  public async linkMap(input: { mapId: string; variantId: string; syncStatus: SupplierSyncStatus }): Promise<SupplierProductMapRecord | null> {
    const map = this.maps.get(input.mapId);
    if (!map) return null;
    map.variantId = input.variantId;
    map.syncStatus = input.syncStatus;
    return map;
  }

  public async markDiscontinuedNotSeenSince(target: string, runStartedAt: Date): Promise<number> {
    let count = 0;
    for (const map of this.maps.values()) {
      if (map.supplierId !== target || map.syncStatus === SupplierSyncStatus.DISCONTINUED) continue;
      if (!map.lastSeenAt || new Date(map.lastSeenAt) < runStartedAt) {
        map.syncStatus = SupplierSyncStatus.DISCONTINUED;
        count += 1;
      }
    }
    return count;
  }

  public async listOrderRefs(target: string): Promise<SupplierOrderRefRecord[]> {
    return [...this.orderRefs.values()].filter((ref) => ref.orderId === target);
  }

  public async findOrderRef(target: string, targetSupplierId: string): Promise<SupplierOrderRefRecord | null> {
    return [...this.orderRefs.values()].find((ref) => ref.orderId === target && ref.supplierId === targetSupplierId) ?? null;
  }

  public async findOrderRefByExternalOrderId(target: string, externalOrderId: string): Promise<SupplierOrderRefRecord | null> {
    return (
      [...this.orderRefs.values()].find((ref) => ref.supplierId === target && ref.externalOrderId === externalOrderId) ?? null
    );
  }

  public async createOrderRef(record: {
    id: string;
    orderId: string;
    supplierId: string;
    idempotencyKey: string;
  }): Promise<SupplierOrderRefRecord> {
    const existing = await this.findOrderRef(record.orderId, record.supplierId);
    if (existing) return existing;
    const ref: SupplierOrderRefRecord = {
      id: record.id,
      orderId: record.orderId,
      supplierId: record.supplierId,
      externalOrderId: null,
      status: SupplierForwardStatus.PENDING,
      attempts: 0,
      lastError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.orderRefs.set(record.id, ref);
    return ref;
  }

  public async updateOrderRef(input: {
    id: string;
    status: SupplierForwardStatus;
    externalOrderId?: string | null | undefined;
    lastError?: string | null | undefined;
    incrementAttempts?: boolean | undefined;
  }): Promise<SupplierOrderRefRecord | null> {
    const ref = this.orderRefs.get(input.id);
    if (!ref) return null;
    ref.status = input.status;
    if (input.externalOrderId !== undefined) ref.externalOrderId = input.externalOrderId;
    if (input.lastError !== undefined) ref.lastError = input.lastError;
    if (input.incrementAttempts) ref.attempts += 1;
    return ref;
  }

  public async recordWebhookEvent(target: string, eventId: string): Promise<boolean> {
    const key = `${target}:${eventId}`;
    if (this.webhookEvents.has(key)) return false;
    this.webhookEvents.add(key);
    return true;
  }

  public async enqueueOutbox(event: { eventType: string; payload: Record<string, unknown> }): Promise<void> {
    this.outbox.push({ eventType: event.eventType, payload: event.payload });
  }
}

const apiConfig: SupplierApiConfigInput = {
  baseUrl: "https://api.proveedor.example",
  authKind: "api_key",
  apiKey: "clave-super-secreta",
  webhookSecret: "webhook-secret-de-16-o-mas",
};

type Deps = {
  repository?: FakeRepository;
  urlGuard?: UrlGuardPort;
  fetcher?: FeedFetcherPort;
  forwarder?: FakeForwarder;
  lock?: FeedLockPort;
  pricing?: FakePricingImport;
  inventory?: FakeInventoryImport;
  orders?: FakeOrders;
};

const newService = (deps?: Deps) =>
  new SupplierService(
    deps?.repository ?? new FakeRepository(),
    new FakeCipher(),
    deps?.urlGuard ?? new FakeUrlGuard(),
    deps?.fetcher ?? new FakeFetcher([]),
    deps?.forwarder ?? new FakeForwarder(),
    deps?.lock ?? new FakeLock(),
    deps?.pricing ?? new FakePricingImport(),
    deps?.inventory ?? new FakeInventoryImport(),
    deps?.orders ?? new FakeOrders(null),
  );

const seedSupplier = async (repository: FakeRepository, options?: { withApi?: boolean; isActive?: boolean }) => {
  await repository.createSupplier({
    id: supplierId,
    name: "Proveedor Uno",
    slug: "proveedor-uno",
    contact: null,
    apiConfigEnc: options?.withApi === false ? null : new FakeCipher().encrypt(apiConfig),
  });
  if (options?.isActive === false) {
    await repository.setSupplierActive(supplierId, false);
  }
};

const seedFeed = async (repository: FakeRepository) => {
  await repository.upsertFeed({
    id: feedId,
    supplierId,
    kind: SupplierFeedKind.CSV,
    sourceUrl: "https://feed.proveedor.example/products.csv",
    schedule: null,
    fieldMap: null,
  });
};

const seedLinkedMap = async (repository: FakeRepository, externalId = "SKU-1") => {
  await repository.upsertMapRow({
    id: `018f0000-0000-7000-8000-0000000000e${externalId.slice(-1)}`,
    supplierId,
    externalId,
    raw: {},
    contentHash: "hash-viejo",
    syncStatus: SupplierSyncStatus.LINKED,
    seenAt: new Date(Date.now() - 86_400_000),
    synced: true,
  });
  const map = await repository.findMapByExternalId(supplierId, externalId);
  if (map) {
    await repository.linkMap({ mapId: map.id, variantId, syncStatus: SupplierSyncStatus.LINKED });
  }
};

describe("SupplierService ABM", () => {
  it("crea proveedor cifrando la config y nunca expone el secreto", async () => {
    const repository = new FakeRepository();
    const service = newService({ repository });
    const result = await service.createSupplier(owner, { name: "Proveedor Uno", apiConfig });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hasApiConfig).toBe(true);
    expect(JSON.stringify(result.value)).not.toContain("clave-super-secreta");
    const stored = repository.suppliers.get(result.value.id);
    expect(stored?.apiConfigEnc?.startsWith("enc:")).toBe(true);
  });

  it("rechaza slug duplicado", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    const service = newService({ repository });
    const result = await service.createSupplier(owner, { name: "Otro", slug: "proveedor-uno" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("SLUG_CONFLICT");
  });

  it("bloquea base URL SSRF al configurar API", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    const service = newService({ repository, urlGuard: new FakeUrlGuard(true) });
    const result = await service.setApiConfig(owner, { supplierId, apiConfig });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("SSRF_BLOCKED");
  });

  it("rechaza a un rol sin permiso de gestion", async () => {
    const result = await newService().createSupplier(support, { name: "Proveedor" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("FORBIDDEN");
  });
});

describe("SupplierService.runFeedImport", () => {
  const row = (externalId: string, cost: number, stock: number) => ({
    external_id: externalId,
    title: "Producto",
    cost_amount_minor: String(cost),
    stock: String(stock),
    discontinued: "false",
  });

  it("crea altas como PENDING_REVIEW sin publicar productos", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedFeed(repository);
    const service = newService({ repository, fetcher: new FakeFetcher([row("NUEVO-1", 5000, 10)]) });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary.created).toBe(1);
    const map = await repository.findMapByExternalId(supplierId, "NUEVO-1");
    expect(map?.syncStatus).toBe(SupplierSyncStatus.PENDING_REVIEW);
  });

  it("delegando costo a pricing y stock a inventory para filas vinculadas", async () => {
    const repository = new FakeRepository();
    const pricing = new FakePricingImport();
    const inventory = new FakeInventoryImport();
    await seedSupplier(repository);
    await seedFeed(repository);
    await seedLinkedMap(repository);
    const service = newService({ repository, pricing, inventory, fetcher: new FakeFetcher([row("SKU-1", 7500, 42)]) });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(true);
    expect(pricing.calls).toEqual([{ variantId, costAmountMinor: 7500 }]);
    expect(inventory.calls).toEqual([{ variantId, stock: 42 }]);
  });

  it("es idempotente por content_hash: re-procesar no duplica movimientos", async () => {
    const repository = new FakeRepository();
    const pricing = new FakePricingImport();
    await seedSupplier(repository);
    await seedFeed(repository);
    await seedLinkedMap(repository);
    const fetcher = new FakeFetcher([row("SKU-1", 7500, 42)]);
    const service = newService({ repository, pricing, fetcher });
    const first = await service.runFeedImport(owner, { feedId, dryRun: false });
    const second = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(pricing.calls.length).toBe(1);
    expect(second.value.summary.unchanged).toBe(1);
  });

  it("filas invalidas se saltan y la corrida queda PARTIAL", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedFeed(repository);
    const service = newService({
      repository,
      fetcher: new FakeFetcher([row("OK-1", 1000, 5), { titulo: "sin external id" }]),
    });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe(SupplierFeedStatus.PARTIAL);
    expect(result.value.summary.skipped).toBe(1);
  });

  it("una corrida FALLIDA nunca discontinua productos", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedFeed(repository);
    await seedLinkedMap(repository);
    const service = newService({ repository, fetcher: new FakeFetcher(null) });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("UPSTREAM_UNAVAILABLE");
    const map = await repository.findMapByExternalId(supplierId, "SKU-1");
    expect(map?.syncStatus).toBe(SupplierSyncStatus.LINKED);
    expect(repository.feedRunResults.at(-1)?.status).toBe(SupplierFeedStatus.FAILED);
  });

  it("una corrida COMPLETA discontinua lo que dejo de aparecer", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedFeed(repository);
    await seedLinkedMap(repository, "SKU-1");
    const service = newService({ repository, fetcher: new FakeFetcher([row("OTRO-1", 900, 3)]) });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.summary.discontinued).toBe(1);
    const map = await repository.findMapByExternalId(supplierId, "SKU-1");
    expect(map?.syncStatus).toBe(SupplierSyncStatus.DISCONTINUED);
  });

  it("rechaza corrida concurrente sobre el mismo feed", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedFeed(repository);
    const service = newService({ repository, lock: new FakeLock(false) });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("FEED_RUN_IN_PROGRESS");
  });

  it("re-valida SSRF en cada corrida", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedFeed(repository);
    const service = newService({ repository, urlGuard: new FakeUrlGuard(true) });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("SSRF_BLOCKED");
  });

  it("pasa al fetcher la IP publica validada para evitar DNS rebinding", async () => {
    const repository = new FakeRepository();
    const fetcher = new FakeFetcher([row("NUEVO-1", 5000, 10)]);
    await seedSupplier(repository);
    await seedFeed(repository);
    const service = newService({ repository, urlGuard: new FakeUrlGuard(false, "203.0.113.77"), fetcher });
    const result = await service.runFeedImport(owner, { feedId, dryRun: false });
    expect(result.ok).toBe(true);
    expect(fetcher.inputs[0]).toMatchObject({
      sourceUrl: "https://feed.proveedor.example/products.csv",
      resolvedIp: "203.0.113.77",
    });
  });
});

describe("SupplierService.linkProduct", () => {
  it("no permite mapear la misma variante a dos external ids del proveedor", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedLinkedMap(repository, "SKU-1");
    await repository.upsertMapRow({
      id: "018f0000-0000-7000-8000-0000000000ff",
      supplierId,
      externalId: "SKU-2",
      raw: {},
      contentHash: null as unknown as string,
      syncStatus: SupplierSyncStatus.PENDING_REVIEW,
      seenAt: new Date(),
      synced: false,
    });
    const service = newService({ repository });
    const result = await service.linkProduct(owner, { mapId: "018f0000-0000-7000-8000-0000000000ff", variantId });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("VARIANT_ALREADY_MAPPED");
  });
});

describe("SupplierService.forwardOrder", () => {
  const forwardableOrder: ForwardableOrder = {
    orderId,
    orderNumber: "CC-0001",
    isConfirmed: true,
    lines: [{ variantId, quantity: 2, title: "Producto" }],
    shippingAddress: {
      recipientName: "Cliente",
      province: "Buenos Aires",
      city: "Buenos Aires",
      street: "Calle Falsa",
      streetNumber: "123",
      postalCode: "1000",
    },
  };

  it("reenvia una vez por proveedor y guarda el external order id", async () => {
    const repository = new FakeRepository();
    const forwarder = new FakeForwarder("accept");
    await seedSupplier(repository);
    await seedLinkedMap(repository);
    const service = newService({ repository, forwarder, orders: new FakeOrders(forwardableOrder) });
    const result = await service.forwardOrder(system, { orderId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe(SupplierForwardStatus.ACCEPTED);
    expect(result.value[0]?.externalOrderId).toBe("EXT-001");
    expect(forwarder.calls).toBe(1);
    expect(repository.outbox.some((event) => event.eventType === "SupplierOrderForwarded")).toBe(true);
  });

  it("re-valida SSRF y usa la IP validada al reenviar al proveedor", async () => {
    const repository = new FakeRepository();
    const forwarder = new FakeForwarder("accept");
    const urlGuard = new FakeUrlGuard(false, "203.0.113.88");
    await seedSupplier(repository);
    await seedLinkedMap(repository);
    const service = newService({ repository, forwarder, urlGuard, orders: new FakeOrders(forwardableOrder) });
    const result = await service.forwardOrder(system, { orderId });
    expect(result.ok).toBe(true);
    expect(urlGuard.calls).toContain(apiConfig.baseUrl);
    expect(forwarder.inputs[0]?.resolvedIp).toBe("203.0.113.88");
  });

  it("bloquea el reenvio si la URL base guardada ahora resuelve a una IP privada", async () => {
    const repository = new FakeRepository();
    const forwarder = new FakeForwarder("accept");
    await seedSupplier(repository);
    await seedLinkedMap(repository);
    const service = newService({
      repository,
      forwarder,
      urlGuard: new FakeUrlGuard(true),
      orders: new FakeOrders(forwardableOrder),
    });
    const result = await service.forwardOrder(system, { orderId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe(SupplierForwardStatus.FAILED);
    expect(result.value[0]?.lastError).toBe("ssrf_blocked");
    expect(forwarder.calls).toBe(0);
  });

  it("es idempotente: un ref ACCEPTED no se reenvia", async () => {
    const repository = new FakeRepository();
    const forwarder = new FakeForwarder("accept");
    await seedSupplier(repository);
    await seedLinkedMap(repository);
    const service = newService({ repository, forwarder, orders: new FakeOrders(forwardableOrder) });
    await service.forwardOrder(system, { orderId });
    await service.forwardOrder(system, { orderId });
    expect(forwarder.calls).toBe(1);
  });

  it("registra rechazo del proveedor sin reintentar en loop", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedLinkedMap(repository);
    const service = newService({ repository, forwarder: new FakeForwarder("reject"), orders: new FakeOrders(forwardableOrder) });
    const result = await service.forwardOrder(system, { orderId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe(SupplierForwardStatus.REJECTED);
    expect(repository.outbox.some((event) => event.eventType === "SupplierOrderRejected")).toBe(true);
  });

  it("marca FAILED con reintento cuando el proveedor esta caido", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    await seedLinkedMap(repository);
    const service = newService({ repository, forwarder: new FakeForwarder("down"), orders: new FakeOrders(forwardableOrder) });
    const result = await service.forwardOrder(system, { orderId });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.status).toBe(SupplierForwardStatus.FAILED);
    expect(result.value[0]?.attempts).toBe(1);
  });
});

describe("SupplierService.handleWebhook", () => {
  const buildWebhook = (options?: { secret?: string; ageSeconds?: number; eventId?: string; externalOrderId?: string }) => {
    const body = JSON.stringify({
      eventId: options?.eventId ?? "evt-00000001",
      externalOrderId: options?.externalOrderId ?? "EXT-001",
      status: "DISPATCHED",
      carrier: "OCA",
      trackingCode: "TRK-123",
      occurredAt: new Date().toISOString(),
    });
    const timestamp = String(Math.floor(Date.now() / 1000) - (options?.ageSeconds ?? 0));
    const signature = createHmac("sha256", options?.secret ?? apiConfig.webhookSecret ?? "")
      .update(`${timestamp}.${body}`)
      .digest("hex");
    return { rawBody: body, headers: { signature, timestamp } };
  };

  const seedAcceptedRef = async (repository: FakeRepository) => {
    const ref = await repository.createOrderRef({
      id: "018f0000-0000-7000-8000-0000000000aa",
      orderId,
      supplierId,
      idempotencyKey: "k",
    });
    await repository.updateOrderRef({ id: ref.id, status: SupplierForwardStatus.ACCEPTED, externalOrderId: "EXT-001" });
  };

  it("procesa un webhook valido y actualiza el envio", async () => {
    const repository = new FakeRepository();
    const orders = new FakeOrders(null);
    await seedSupplier(repository);
    await seedAcceptedRef(repository);
    const service = newService({ repository, orders });
    const webhook = buildWebhook();
    const result = await service.handleWebhook({ supplierSlug: "proveedor-uno", ...webhook });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.processed).toBe(true);
    expect(orders.shipmentUpdates).toEqual([{ orderId, status: "DISPATCHED" }]);
    expect(repository.outbox.some((event) => event.eventType === "SupplierShipmentUpdated")).toBe(true);
  });

  it("rechaza firma invalida", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    const service = newService({ repository });
    const webhook = buildWebhook({ secret: "otro-secreto-que-no-es-1234" });
    const result = await service.handleWebhook({ supplierSlug: "proveedor-uno", ...webhook });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("WEBHOOK_SIGNATURE_INVALID");
  });

  it("rechaza eventos fuera de la ventana anti-replay", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    const service = newService({ repository });
    const webhook = buildWebhook({ ageSeconds: 600 });
    const result = await service.handleWebhook({ supplierSlug: "proveedor-uno", ...webhook });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("WEBHOOK_REPLAYED");
  });

  it("un eventId repetido responde idempotente sin re-procesar", async () => {
    const repository = new FakeRepository();
    const orders = new FakeOrders(null);
    await seedSupplier(repository);
    await seedAcceptedRef(repository);
    const service = newService({ repository, orders });
    const webhook = buildWebhook();
    await service.handleWebhook({ supplierSlug: "proveedor-uno", ...webhook });
    const second = await service.handleWebhook({ supplierSlug: "proveedor-uno", ...webhook });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.duplicate).toBe(true);
    expect(orders.shipmentUpdates.length).toBe(1);
  });

  it("no correlaciona un external order id desconocido", async () => {
    const repository = new FakeRepository();
    await seedSupplier(repository);
    const service = newService({ repository });
    const webhook = buildWebhook({ externalOrderId: "NO-EXISTE" });
    const result = await service.handleWebhook({ supplierSlug: "proveedor-uno", ...webhook });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("WEBHOOK_UNMATCHED");
  });
});
