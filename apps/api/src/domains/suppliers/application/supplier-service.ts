import {
  ShipmentStatus,
  SupplierFeedStatus,
  SupplierForwardStatus,
  SupplierSyncStatus,
  type Actor,
  type FeedRunResult,
  type SupplierFeedRecord,
  type SupplierFeedRunSummary,
  type SupplierListResult,
  type SupplierOrderRefRecord,
  type SupplierProductMapRecord,
  type SupplierSummary,
} from "@cloudcommerce/types";
import {
  SupplierFeedRowSchema,
  SupplierWebhookPayloadSchema,
  type ConfigureFeedInput,
  type CreateSupplierInput,
  type GetSupplierInput,
  type LinkSupplierProductInput,
  type ListFeedsInput,
  type ListOrderRefsInput,
  type ListSupplierMapInput,
  type ListSuppliersInput,
  type RetryForwardInput,
  type RunFeedInput,
  type SetSupplierActiveInput,
  type SetSupplierApiConfigInput,
  type UpdateSupplierInput,
} from "@cloudcommerce/validators";
import { createHmac, timingSafeEqual } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { SupplierDomainError } from "../../../shared/errors/domain-error.js";
import { computeContentHash, forwardIdempotencyKey, sanitizeRawRow } from "../domain/feed-pipeline.js";
import {
  canManageSuppliers,
  canMapSupplierProducts,
  canRetryForward,
  canRunFeeds,
  canViewForwardStatus,
  canViewSuppliers,
} from "../domain/supplier-permissions.js";
import type {
  ApiConfigCipherPort,
  FeedFetcherPort,
  FeedLockPort,
  ForwardOrderPayload,
  InventoryImportPort,
  OrdersIntegrationPort,
  PricingImportPort,
  SupplierForwarderPort,
  SupplierRepository,
  UrlGuardPort,
} from "./ports.js";

const WEBHOOK_REPLAY_WINDOW_SECONDS = 300;
const MAX_FORWARD_ATTEMPTS = 5;

type WebhookHeaders = {
  signature: string | undefined;
  timestamp: string | undefined;
};

export type WebhookResult = { processed: boolean; duplicate: boolean };

export class SupplierService {
  public constructor(
    private readonly repository: SupplierRepository,
    private readonly cipher: ApiConfigCipherPort,
    private readonly urlGuard: UrlGuardPort,
    private readonly feedFetcher: FeedFetcherPort,
    private readonly forwarder: SupplierForwarderPort,
    private readonly feedLock: FeedLockPort,
    private readonly pricingImport: PricingImportPort,
    private readonly inventoryImport: InventoryImportPort,
    private readonly orders: OrdersIntegrationPort,
  ) {}

  // ------------------------------------------------------------------
  // ABM de proveedores
  // ------------------------------------------------------------------

  public async listSuppliers(actor: Actor, input: ListSuppliersInput): Promise<Result<SupplierListResult, SupplierDomainError>> {
    if (!canViewSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const result = await this.repository.listSuppliers(input);
    return ok({ items: result.items.map(sanitizeSummary), nextCursor: result.nextCursor });
  }

  public async getSupplier(actor: Actor, input: GetSupplierInput): Promise<Result<SupplierSummary, SupplierDomainError>> {
    if (!canViewSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const supplier = await this.repository.findSupplierById(input.supplierId);
    return supplier ? ok(presentSupplier(supplier)) : err({ type: "SUPPLIER_NOT_FOUND" });
  }

  public async createSupplier(actor: Actor, input: CreateSupplierInput): Promise<Result<SupplierSummary, SupplierDomainError>> {
    if (!canManageSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const slug = input.slug ?? slugify(input.name);
    const existing = await this.repository.findSupplierBySlug(slug);
    if (existing) {
      return err({ type: "SLUG_CONFLICT" });
    }
    let apiConfigEnc: string | null = null;
    if (input.apiConfig) {
      const verdict = await this.urlGuard.validate(input.apiConfig.baseUrl);
      if (!verdict.allowed) {
        return err({ type: "SSRF_BLOCKED", reason: verdict.reason });
      }
      apiConfigEnc = this.cipher.encrypt(input.apiConfig);
    }
    const created = await this.repository.createSupplier({
      id: uuidv7(),
      name: input.name,
      slug,
      contact: input.contact ?? null,
      apiConfigEnc,
    });
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "supplier",
      aggregateId: created.id,
      eventType: "SupplierCreated",
      payload: { supplierId: created.id, slug },
    });
    return ok(sanitizeSummary(created));
  }

  public async updateSupplier(actor: Actor, input: UpdateSupplierInput): Promise<Result<SupplierSummary, SupplierDomainError>> {
    if (!canManageSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const updated = await this.repository.updateSupplier({
      id: input.supplierId,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contact !== undefined ? { contact: input.contact } : {}),
    });
    return updated ? ok(sanitizeSummary(updated)) : err({ type: "SUPPLIER_NOT_FOUND" });
  }

  public async setActive(actor: Actor, input: SetSupplierActiveInput): Promise<Result<SupplierSummary, SupplierDomainError>> {
    if (!canManageSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const updated = await this.repository.setSupplierActive(input.supplierId, input.isActive);
    return updated ? ok(sanitizeSummary(updated)) : err({ type: "SUPPLIER_NOT_FOUND" });
  }

  public async setApiConfig(actor: Actor, input: SetSupplierApiConfigInput): Promise<Result<SupplierSummary, SupplierDomainError>> {
    if (!canManageSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const verdict = await this.urlGuard.validate(input.apiConfig.baseUrl);
    if (!verdict.allowed) {
      return err({ type: "SSRF_BLOCKED", reason: verdict.reason });
    }
    const updated = await this.repository.setSupplierApiConfig(input.supplierId, this.cipher.encrypt(input.apiConfig));
    return updated ? ok(sanitizeSummary(updated)) : err({ type: "SUPPLIER_NOT_FOUND" });
  }

  // ------------------------------------------------------------------
  // Feeds
  // ------------------------------------------------------------------

  public async listFeeds(actor: Actor, input: ListFeedsInput): Promise<Result<SupplierFeedRecord[], SupplierDomainError>> {
    if (!canViewSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    return ok(await this.repository.listFeeds(input.supplierId));
  }

  public async configureFeed(actor: Actor, input: ConfigureFeedInput): Promise<Result<SupplierFeedRecord, SupplierDomainError>> {
    if (!canManageSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const supplier = await this.repository.findSupplierById(input.supplierId);
    if (!supplier) {
      return err({ type: "SUPPLIER_NOT_FOUND" });
    }
    if (!input.sourceUrl) {
      return err({ type: "FEED_SOURCE_REQUIRED" });
    }
    const verdict = await this.urlGuard.validate(input.sourceUrl);
    if (!verdict.allowed) {
      return err({ type: "SSRF_BLOCKED", reason: verdict.reason });
    }
    const existing = (await this.repository.listFeeds(input.supplierId)).find((feed) => feed.kind === input.kind);
    const feed = await this.repository.upsertFeed({
      id: existing?.id ?? uuidv7(),
      supplierId: input.supplierId,
      kind: input.kind,
      sourceUrl: input.sourceUrl,
      schedule: input.schedule ?? null,
      fieldMap: input.fieldMap ?? null,
    });
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "supplier",
      aggregateId: input.supplierId,
      eventType: "SupplierFeedConfigured",
      payload: { supplierId: input.supplierId, feedId: feed.id, kind: input.kind },
    });
    return ok(feed);
  }

  /**
   * Caso de uso central de la entrada de catálogo:
   * fetch → parse → validate → map → diff → upsert(precio · stock) → report.
   * Idempotente por (supplier_id, external_id) + content_hash. Nunca marca
   * discontinuados si la corrida no completó (feed parcial/FAILED).
   */
  public async runFeedImport(actor: Actor, input: RunFeedInput): Promise<Result<FeedRunResult, SupplierDomainError>> {
    if (!canRunFeeds(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const feed = await this.repository.findFeedById(input.feedId);
    if (!feed) {
      return err({ type: "FEED_NOT_FOUND" });
    }
    if (feed.status === SupplierFeedStatus.DISABLED) {
      return err({ type: "FEED_NOT_FOUND" });
    }
    const supplier = await this.repository.findSupplierById(feed.supplierId);
    if (!supplier) {
      return err({ type: "SUPPLIER_NOT_FOUND" });
    }
    if (!supplier.isActive) {
      return err({ type: "SUPPLIER_INACTIVE" });
    }
    if (!feed.sourceUrl) {
      return err({ type: "FEED_SOURCE_REQUIRED" });
    }
    const verdict = await this.urlGuard.validate(feed.sourceUrl);
    if (!verdict.allowed) {
      return err({ type: "SSRF_BLOCKED", reason: verdict.reason });
    }
    const acquired = await this.feedLock.acquire(feed.id);
    if (!acquired) {
      return err({ type: "FEED_RUN_IN_PROGRESS" });
    }
    const runStartedAt = new Date();
    try {
      if (!input.dryRun) {
        await this.repository.setFeedStatus(feed.id, SupplierFeedStatus.RUNNING);
      }
      const fetched = await this.feedFetcher.fetchRows({ kind: feed.kind, sourceUrl: feed.sourceUrl });
      if (!fetched.ok) {
        if (!input.dryRun) {
          await this.repository.setFeedRunResult({
            feedId: feed.id,
            status: SupplierFeedStatus.FAILED,
            summary: emptySummary(),
            lastRunAt: runStartedAt,
          });
        }
        return err({ type: "UPSTREAM_UNAVAILABLE" });
      }

      const summary = emptySummary();
      const fieldMap = feed.fieldMap;
      for (const rawRow of fetched.value) {
        summary.read += 1;
        const sanitized = sanitizeRawRow(rawRow);
        const mapped = applyFieldMap(sanitized, fieldMap);
        const parsed = SupplierFeedRowSchema.safeParse(mapped);
        if (!parsed.success) {
          summary.skipped += 1;
          continue;
        }
        const row = parsed.data;
        if (input.dryRun) {
          summary.updated += 1;
          continue;
        }
        const existing = await this.repository.findMapByExternalId(supplier.id, row.externalId);
        const contentHash = computeContentHash(row);
        if (existing && existing.contentHash === contentHash) {
          summary.unchanged += 1;
          await this.repository.upsertMapRow({
            id: existing.id,
            supplierId: supplier.id,
            externalId: row.externalId,
            raw: sanitized,
            contentHash,
            syncStatus: existing.syncStatus,
            seenAt: runStartedAt,
            synced: false,
          });
          continue;
        }
        if (!existing) {
          // Alta: el import no crea productos publicables sin revisión — queda PENDING_REVIEW.
          await this.repository.upsertMapRow({
            id: uuidv7(),
            supplierId: supplier.id,
            externalId: row.externalId,
            raw: sanitized,
            contentHash,
            syncStatus: SupplierSyncStatus.PENDING_REVIEW,
            seenAt: runStartedAt,
            synced: false,
          });
          summary.created += 1;
          continue;
        }
        let rowFailed = false;
        let nextStatus = existing.syncStatus;
        if (existing.variantId && existing.syncStatus === SupplierSyncStatus.LINKED) {
          if (row.discontinued) {
            nextStatus = SupplierSyncStatus.DISCONTINUED;
            summary.discontinued += 1;
          } else {
            if (row.costAmountMinor !== undefined) {
              const applied = await this.pricingImport.applySupplierCost({
                variantId: existing.variantId,
                supplierId: supplier.id,
                costAmountMinor: row.costAmountMinor,
              });
              if (!applied) rowFailed = true;
            }
            if (row.stock !== undefined) {
              const applied = await this.inventoryImport.applyStockLevel({
                variantId: existing.variantId,
                stock: row.stock,
                reason: `Import de feed ${supplier.slug}`,
                refId: `${feed.id}:${runStartedAt.getTime()}:${row.externalId}`,
              });
              if (!applied) rowFailed = true;
            }
          }
        }
        await this.repository.upsertMapRow({
          id: existing.id,
          supplierId: supplier.id,
          externalId: row.externalId,
          raw: sanitized,
          contentHash,
          syncStatus: nextStatus,
          seenAt: runStartedAt,
          synced: !rowFailed,
        });
        if (rowFailed) {
          summary.errors += 1;
        } else if (nextStatus !== SupplierSyncStatus.DISCONTINUED) {
          summary.updated += 1;
        }
        if (existing.variantId) {
          await this.repository.enqueueOutbox({
            id: uuidv7(),
            aggregateType: "supplier",
            aggregateId: supplier.id,
            eventType: "SupplierProductImported",
            payload: { supplierId: supplier.id, externalId: row.externalId, variantId: existing.variantId },
          });
        }
      }

      if (!input.dryRun) {
        // Solo una corrida COMPLETA puede discontinuar por ausencia.
        summary.discontinued += await this.repository.markDiscontinuedNotSeenSince(supplier.id, runStartedAt);
      }

      const status = summary.errors > 0 || summary.skipped > 0 ? SupplierFeedStatus.PARTIAL : SupplierFeedStatus.OK;
      if (!input.dryRun) {
        await this.repository.setFeedRunResult({ feedId: feed.id, status, summary, lastRunAt: runStartedAt });
        await this.repository.enqueueOutbox({
          id: uuidv7(),
          aggregateType: "supplier",
          aggregateId: supplier.id,
          eventType: "SupplierFeedRunCompleted",
          payload: { feedId: feed.id, status, ...summary },
        });
      }
      return ok({ feedId: feed.id, status, dryRun: input.dryRun, summary });
    } finally {
      await this.feedLock.release(feed.id);
    }
  }

  // ------------------------------------------------------------------
  // Mapeo proveedor ↔ catálogo
  // ------------------------------------------------------------------

  public async listMap(
    actor: Actor,
    input: ListSupplierMapInput,
  ): Promise<Result<{ items: SupplierProductMapRecord[]; nextCursor: string | null }, SupplierDomainError>> {
    if (!canViewSuppliers(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    return ok(await this.repository.listMap(input));
  }

  public async linkProduct(actor: Actor, input: LinkSupplierProductInput): Promise<Result<SupplierProductMapRecord, SupplierDomainError>> {
    if (!canMapSupplierProducts(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const map = await this.repository.findMapById(input.mapId);
    if (!map) {
      return err({ type: "MAP_NOT_FOUND" });
    }
    const claimed = await this.repository.findMapByVariantId(map.supplierId, input.variantId);
    if (claimed && claimed.id !== map.id) {
      return err({ type: "VARIANT_ALREADY_MAPPED" });
    }
    const linked = await this.repository.linkMap({
      mapId: input.mapId,
      variantId: input.variantId,
      syncStatus: SupplierSyncStatus.LINKED,
    });
    if (!linked) {
      return err({ type: "MAP_NOT_FOUND" });
    }
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "supplier",
      aggregateId: map.supplierId,
      eventType: "SupplierProductMapped",
      payload: { supplierId: map.supplierId, externalId: map.externalId, variantId: input.variantId },
    });
    return ok(linked);
  }

  // ------------------------------------------------------------------
  // Forward de pedidos
  // ------------------------------------------------------------------

  public async listOrderRefs(actor: Actor, input: ListOrderRefsInput): Promise<Result<SupplierOrderRefRecord[], SupplierDomainError>> {
    if (!canViewForwardStatus(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    return ok(await this.repository.listOrderRefs(input.orderId));
  }

  /**
   * Reenvía una orden confirmada a sus proveedores. Idempotente por
   * (order_id, supplier_id): un ref SENT/ACCEPTED no se reenvía. Lo dispara el
   * worker que consume OrderConfirmed, o un admin vía retryForward.
   */
  public async forwardOrder(
    actor: Actor,
    input: { orderId: string; supplierId?: string | undefined },
  ): Promise<Result<SupplierOrderRefRecord[], SupplierDomainError>> {
    if (!canRetryForward(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const order = await this.orders.getForwardableOrder(input.orderId);
    if (!order) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    if (!order.isConfirmed) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    const maps = await this.repository.findMapsByVariantIds(order.lines.map((line) => line.variantId));
    const bySupplier = new Map<string, Array<{ externalId: string; quantity: number; title: string }>>();
    for (const line of order.lines) {
      const map = maps.find((candidate) => candidate.variantId === line.variantId);
      if (!map) {
        continue;
      }
      if (input.supplierId && map.supplierId !== input.supplierId) {
        continue;
      }
      const lines = bySupplier.get(map.supplierId) ?? [];
      lines.push({ externalId: map.externalId, quantity: line.quantity, title: line.title });
      bySupplier.set(map.supplierId, lines);
    }
    if (bySupplier.size === 0) {
      return input.supplierId ? err({ type: "ORDER_REF_NOT_FOUND" }) : ok([]);
    }

    const results: SupplierOrderRefRecord[] = [];
    for (const [supplierId, lines] of bySupplier) {
      const ref = await this.forwardToSupplier(order, supplierId, lines);
      results.push(ref);
    }
    return ok(results);
  }

  public async retryForward(actor: Actor, input: RetryForwardInput): Promise<Result<SupplierOrderRefRecord, SupplierDomainError>> {
    if (!canRetryForward(actor)) {
      return err(actor.kind === "public" ? { type: "UNAUTHENTICATED" } : { type: "FORBIDDEN" });
    }
    const existing = await this.repository.findOrderRef(input.orderId, input.supplierId);
    if (existing && (existing.status === SupplierForwardStatus.SENT || existing.status === SupplierForwardStatus.ACCEPTED)) {
      return err({ type: "FORWARD_ALREADY_SENT" });
    }
    const forwarded = await this.forwardOrder(actor, { orderId: input.orderId, supplierId: input.supplierId });
    if (!forwarded.ok) {
      return forwarded;
    }
    const ref = forwarded.value.find((candidate) => candidate.supplierId === input.supplierId);
    return ref ? ok(ref) : err({ type: "ORDER_REF_NOT_FOUND" });
  }

  private async forwardToSupplier(
    order: { orderId: string; orderNumber: string; shippingAddress: ForwardOrderPayload["shippingAddress"] },
    supplierId: string,
    lines: Array<{ externalId: string; quantity: number; title: string }>,
  ): Promise<SupplierOrderRefRecord> {
    const idempotencyKey = forwardIdempotencyKey(order.orderId, supplierId);
    let ref = await this.repository.findOrderRef(order.orderId, supplierId);
    if (ref && (ref.status === SupplierForwardStatus.SENT || ref.status === SupplierForwardStatus.ACCEPTED)) {
      return ref;
    }
    ref ??= await this.repository.createOrderRef({ id: uuidv7(), orderId: order.orderId, supplierId, idempotencyKey });
    if (ref.attempts >= MAX_FORWARD_ATTEMPTS) {
      return ref;
    }

    const supplier = await this.repository.findSupplierById(supplierId);
    if (!supplier || !supplier.isActive) {
      return (
        (await this.repository.updateOrderRef({ id: ref.id, status: SupplierForwardStatus.FAILED, lastError: "supplier_inactive" })) ?? ref
      );
    }
    const apiConfig = supplier.apiConfigEnc ? this.cipher.decrypt(supplier.apiConfigEnc) : null;
    if (!apiConfig) {
      return (
        (await this.repository.updateOrderRef({ id: ref.id, status: SupplierForwardStatus.FAILED, lastError: "api_not_configured" })) ?? ref
      );
    }

    const response = await this.forwarder.forwardOrder({
      apiConfig,
      idempotencyKey,
      payload: {
        orderNumber: order.orderNumber,
        externalReference: idempotencyKey,
        lines,
        shippingAddress: order.shippingAddress,
      },
    });
    if (!response.ok) {
      return (
        (await this.repository.updateOrderRef({
          id: ref.id,
          status: SupplierForwardStatus.FAILED,
          lastError: "upstream_unavailable",
          incrementAttempts: true,
        })) ?? ref
      );
    }
    if (!response.value.accepted) {
      const updated = await this.repository.updateOrderRef({
        id: ref.id,
        status: SupplierForwardStatus.REJECTED,
        lastError: response.value.reason ?? "supplier_rejected",
        incrementAttempts: true,
      });
      await this.repository.enqueueOutbox({
        id: uuidv7(),
        aggregateType: "supplier",
        aggregateId: supplierId,
        eventType: "SupplierOrderRejected",
        payload: { orderId: order.orderId, supplierId },
      });
      return updated ?? ref;
    }
    const updated = await this.repository.updateOrderRef({
      id: ref.id,
      status: SupplierForwardStatus.ACCEPTED,
      externalOrderId: response.value.externalOrderId ?? null,
      lastError: null,
      incrementAttempts: true,
    });
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "supplier",
      aggregateId: supplierId,
      eventType: "SupplierOrderForwarded",
      payload: { orderId: order.orderId, supplierId, externalOrderId: response.value.externalOrderId ?? null },
    });
    return updated ?? ref;
  }

  // ------------------------------------------------------------------
  // Webhook de fulfillment
  // ------------------------------------------------------------------

  /**
   * Verifica EN ORDEN antes de tocar el dominio: firma HMAC del cuerpo crudo →
   * anti-replay por timestamp → idempotencia por eventId → schema del payload →
   * correlación con la orden. La firma esperada es
   * `hmac_sha256(webhookSecret, "{timestamp}.{rawBody}")` en hex.
   */
  public async handleWebhook(input: {
    supplierSlug: string;
    rawBody: string;
    headers: WebhookHeaders;
    now?: Date;
  }): Promise<Result<WebhookResult, SupplierDomainError>> {
    const supplier = await this.repository.findSupplierBySlug(input.supplierSlug);
    if (!supplier) {
      return err({ type: "WEBHOOK_SIGNATURE_INVALID" });
    }
    const apiConfig = supplier.apiConfigEnc ? this.cipher.decrypt(supplier.apiConfigEnc) : null;
    const secret = apiConfig?.webhookSecret;
    if (!secret) {
      return err({ type: "WEBHOOK_SIGNATURE_INVALID" });
    }
    const { signature, timestamp } = input.headers;
    if (!signature || !timestamp || !/^\d+$/.test(timestamp)) {
      return err({ type: "WEBHOOK_SIGNATURE_INVALID" });
    }
    const expected = createHmac("sha256", secret).update(`${timestamp}.${input.rawBody}`).digest("hex");
    if (!safeCompare(expected, signature)) {
      return err({ type: "WEBHOOK_SIGNATURE_INVALID" });
    }
    const now = input.now ?? new Date();
    const skewSeconds = Math.abs(now.getTime() / 1000 - Number(timestamp));
    if (skewSeconds > WEBHOOK_REPLAY_WINDOW_SECONDS) {
      return err({ type: "WEBHOOK_REPLAYED" });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(input.rawBody);
    } catch {
      return err({ type: "WEBHOOK_PAYLOAD_INVALID" });
    }
    const payload = SupplierWebhookPayloadSchema.safeParse(parsedBody);
    if (!payload.success) {
      return err({ type: "WEBHOOK_PAYLOAD_INVALID" });
    }

    const fresh = await this.repository.recordWebhookEvent(supplier.id, payload.data.eventId);
    if (!fresh) {
      return ok({ processed: false, duplicate: true });
    }

    const ref = await this.repository.findOrderRefByExternalOrderId(supplier.id, payload.data.externalOrderId);
    if (!ref) {
      return err({ type: "WEBHOOK_UNMATCHED" });
    }
    const applied = await this.orders.applyShipmentUpdate({
      orderId: ref.orderId,
      status: payload.data.status,
      carrier: payload.data.carrier ?? null,
      trackingCode: payload.data.trackingCode ?? null,
      description: payload.data.description ?? null,
      occurredAt: new Date(payload.data.occurredAt),
    });
    if (!applied) {
      return err({ type: "WEBHOOK_UNMATCHED" });
    }
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "supplier",
      aggregateId: supplier.id,
      eventType: "SupplierShipmentUpdated",
      payload: {
        orderId: ref.orderId,
        supplierId: supplier.id,
        status: mapWebhookStatus(payload.data.status),
        trackingCode: payload.data.trackingCode ?? null,
      },
    });
    return ok({ processed: true, duplicate: false });
  }
}

const presentSupplier = (entity: { apiConfigEnc: string | null } & SupplierSummary): SupplierSummary => ({
  id: entity.id,
  name: entity.name,
  slug: entity.slug,
  contact: entity.contact,
  isActive: entity.isActive,
  hasApiConfig: entity.apiConfigEnc !== null,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
});

/** Presenter defensivo: aunque el repo devuelva de más, jamás sale api_config_enc (BOPLA). */
const sanitizeSummary = (summary: SupplierSummary): SupplierSummary => ({
  id: summary.id,
  name: summary.name,
  slug: summary.slug,
  contact: summary.contact,
  isActive: summary.isActive,
  hasApiConfig: summary.hasApiConfig,
  createdAt: summary.createdAt,
  updatedAt: summary.updatedAt,
});

const emptySummary = (): SupplierFeedRunSummary => ({
  read: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  skipped: 0,
  discontinued: 0,
  errors: 0,
});

const applyFieldMap = (raw: Record<string, unknown>, fieldMap: Record<string, string> | null): Record<string, unknown> => {
  const map = {
    externalId: fieldMap?.externalId ?? "external_id",
    title: fieldMap?.title ?? "title",
    costAmountMinor: fieldMap?.costAmountMinor ?? "cost_amount_minor",
    stock: fieldMap?.stock ?? "stock",
    discontinued: fieldMap?.discontinued ?? "discontinued",
  };
  const coerceInt = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
    if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
    return undefined;
  };
  const coerceBool = (value: unknown): boolean => value === true || value === "true" || value === "1" || value === 1;
  const externalId = raw[map.externalId];
  const title = raw[map.title];
  return {
    externalId: typeof externalId === "string" || typeof externalId === "number" ? String(externalId) : undefined,
    ...(typeof title === "string" ? { title } : {}),
    ...(coerceInt(raw[map.costAmountMinor]) !== undefined ? { costAmountMinor: coerceInt(raw[map.costAmountMinor]) } : {}),
    ...(coerceInt(raw[map.stock]) !== undefined ? { stock: coerceInt(raw[map.stock]) } : {}),
    discontinued: coerceBool(raw[map.discontinued]),
  };
};

const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const safeCompare = (expected: string, received: string): boolean => {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

const mapWebhookStatus = (status: string): ShipmentStatus => status as ShipmentStatus;
