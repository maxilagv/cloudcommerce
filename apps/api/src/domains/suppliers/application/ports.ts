import type {
  SupplierContact,
  SupplierFeedKind,
  SupplierFeedRecord,
  SupplierFeedRunSummary,
  SupplierFeedStatus,
  SupplierForwardStatus,
  SupplierOrderRefRecord,
  SupplierProductMapRecord,
  SupplierSummary,
  SupplierSyncStatus,
} from "@cloudcommerce/types";
import type { SupplierApiConfigInput, SupplierForwardResponse } from "@cloudcommerce/validators";
import type { Result } from "../../../shared/domain/result.js";
import type { SsrfVerdict } from "../domain/ssrf-guard.js";

export type SupplierEntity = SupplierSummary & { apiConfigEnc: string | null };

export type CreateSupplierRecord = {
  id: string;
  name: string;
  slug: string;
  contact: SupplierContact | null;
  apiConfigEnc: string | null;
};

export type UpsertFeedRecord = {
  id: string;
  supplierId: string;
  kind: SupplierFeedKind;
  sourceUrl: string | null;
  schedule: string | null;
  fieldMap: Record<string, string> | null;
};

export type UpsertMapRowRecord = {
  id: string;
  supplierId: string;
  externalId: string;
  raw: Record<string, unknown>;
  contentHash: string;
  syncStatus: SupplierSyncStatus;
  seenAt: Date;
  synced: boolean;
};

export interface SupplierRepository {
  listSuppliers(input: { cursor?: string | undefined; limit: number; isActive?: boolean | undefined }): Promise<{
    items: SupplierSummary[];
    nextCursor: string | null;
  }>;
  findSupplierById(id: string): Promise<SupplierEntity | null>;
  findSupplierBySlug(slug: string): Promise<SupplierEntity | null>;
  createSupplier(record: CreateSupplierRecord): Promise<SupplierSummary>;
  updateSupplier(input: { id: string; name?: string | undefined; contact?: SupplierContact | null | undefined }): Promise<SupplierSummary | null>;
  setSupplierActive(id: string, isActive: boolean): Promise<SupplierSummary | null>;
  setSupplierApiConfig(id: string, apiConfigEnc: string): Promise<SupplierSummary | null>;

  listFeeds(supplierId: string): Promise<SupplierFeedRecord[]>;
  findFeedById(feedId: string): Promise<SupplierFeedRecord | null>;
  upsertFeed(record: UpsertFeedRecord): Promise<SupplierFeedRecord>;
  setFeedRunResult(input: {
    feedId: string;
    status: SupplierFeedStatus;
    summary: SupplierFeedRunSummary;
    lastRunAt: Date;
  }): Promise<void>;
  setFeedStatus(feedId: string, status: SupplierFeedStatus): Promise<void>;

  listMap(input: {
    supplierId: string;
    status?: SupplierSyncStatus | undefined;
    cursor?: string | undefined;
    limit: number;
  }): Promise<{ items: SupplierProductMapRecord[]; nextCursor: string | null }>;
  findMapById(mapId: string): Promise<SupplierProductMapRecord | null>;
  findMapByExternalId(supplierId: string, externalId: string): Promise<(SupplierProductMapRecord & { contentHash: string | null }) | null>;
  findMapByVariantId(supplierId: string, variantId: string): Promise<SupplierProductMapRecord | null>;
  findMapsByVariantIds(variantIds: string[]): Promise<SupplierProductMapRecord[]>;
  upsertMapRow(record: UpsertMapRowRecord): Promise<void>;
  linkMap(input: { mapId: string; variantId: string; syncStatus: SupplierSyncStatus }): Promise<SupplierProductMapRecord | null>;
  markDiscontinuedNotSeenSince(supplierId: string, runStartedAt: Date): Promise<number>;

  listOrderRefs(orderId: string): Promise<SupplierOrderRefRecord[]>;
  findOrderRef(orderId: string, supplierId: string): Promise<SupplierOrderRefRecord | null>;
  findOrderRefByExternalOrderId(supplierId: string, externalOrderId: string): Promise<SupplierOrderRefRecord | null>;
  createOrderRef(record: { id: string; orderId: string; supplierId: string; idempotencyKey: string }): Promise<SupplierOrderRefRecord>;
  updateOrderRef(input: {
    id: string;
    status: SupplierForwardStatus;
    externalOrderId?: string | null | undefined;
    lastError?: string | null | undefined;
    incrementAttempts?: boolean | undefined;
  }): Promise<SupplierOrderRefRecord | null>;

  /** Devuelve false si el eventId ya fue visto (idempotencia de webhook). */
  recordWebhookEvent(supplierId: string, eventId: string): Promise<boolean>;

  enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface UrlGuardPort {
  validate(url: string): Promise<SsrfVerdict>;
}

export interface ApiConfigCipherPort {
  encrypt(config: SupplierApiConfigInput): string;
  decrypt(payload: string): SupplierApiConfigInput | null;
}

export interface FeedFetcherPort {
  fetchRows(input: {
    kind: SupplierFeedKind;
    sourceUrl: string;
    resolvedIp: string;
  }): Promise<Result<Array<Record<string, unknown>>, { type: "UPSTREAM_UNAVAILABLE" } | { type: "INVALID_FORMAT" }>>;
}

export type ForwardOrderPayload = {
  orderNumber: string;
  externalReference: string;
  lines: Array<{ externalId: string; quantity: number; title: string }>;
  shippingAddress: {
    recipientName: string | null;
    province: string;
    city: string;
    street: string;
    streetNumber: string | null;
    postalCode: string | null;
  } | null;
};

export interface SupplierForwarderPort {
  forwardOrder(input: {
    apiConfig: SupplierApiConfigInput;
    resolvedIp: string;
    idempotencyKey: string;
    payload: ForwardOrderPayload;
  }): Promise<Result<SupplierForwardResponse, { type: "UPSTREAM_UNAVAILABLE" }>>;
}

export interface FeedLockPort {
  acquire(feedId: string): Promise<boolean>;
  release(feedId: string): Promise<void>;
}

export interface PricingImportPort {
  applySupplierCost(input: { variantId: string; supplierId: string; costAmountMinor: number }): Promise<boolean>;
}

export interface InventoryImportPort {
  applyStockLevel(input: { variantId: string; stock: number; reason: string; refId: string }): Promise<boolean>;
}

export type ForwardableOrder = {
  orderId: string;
  orderNumber: string;
  isConfirmed: boolean;
  lines: Array<{ variantId: string; quantity: number; title: string }>;
  shippingAddress: ForwardOrderPayload["shippingAddress"];
};

export interface OrdersIntegrationPort {
  getForwardableOrder(orderId: string): Promise<ForwardableOrder | null>;
  applyShipmentUpdate(input: {
    orderId: string;
    status: "PREPARED" | "DISPATCHED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "DELAYED" | "FAILED_ATTEMPT";
    carrier: string | null;
    trackingCode: string | null;
    description: string | null;
    occurredAt: Date;
  }): Promise<boolean>;
}
