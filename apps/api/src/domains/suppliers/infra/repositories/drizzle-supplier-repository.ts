import {
  outboxEvent,
  supplier,
  supplierFeed,
  supplierOrderRef,
  supplierProductMap,
  supplierWebhookEvent,
} from "@cloudcommerce/database";
import {
  SupplierSyncStatus,
  type SupplierContact,
  type SupplierFeedRecord,
  type SupplierFeedRunSummary,
  type SupplierFeedStatus,
  type SupplierForwardStatus,
  type SupplierOrderRefRecord,
  type SupplierProductMapRecord,
  type SupplierSummary,
} from "@cloudcommerce/types";
import { and, desc, eq, inArray, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  CreateSupplierRecord,
  SupplierEntity,
  SupplierRepository,
  UpsertFeedRecord,
  UpsertMapRowRecord,
} from "../../application/ports.js";

type Cursor = { createdAt: Date; id: string };

export class DrizzleSupplierRepository implements SupplierRepository {
  public constructor(private readonly db: Database) {}

  public async listSuppliers(input: { cursor?: string | undefined; limit: number; isActive?: boolean | undefined }): Promise<{
    items: SupplierSummary[];
    nextCursor: string | null;
  }> {
    const conditions: SQL[] = [];
    if (input.isActive !== undefined) conditions.push(eq(supplier.isActive, input.isActive));
    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(
        or(lt(supplier.createdAt, cursor.createdAt), and(eq(supplier.createdAt, cursor.createdAt), lt(supplier.id, cursor.id))) ?? sql`false`,
      );
    }
    const query = this.db
      .select()
      .from(supplier)
      .$dynamic()
      .orderBy(desc(supplier.createdAt), desc(supplier.id))
      .limit(input.limit + 1);
    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    const visible = rows.slice(0, input.limit).map(mapSupplierSummary);
    const last = rows.length > input.limit ? rows[input.limit - 1] : null;
    return {
      items: visible,
      nextCursor: last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  public async findSupplierById(id: string): Promise<SupplierEntity | null> {
    const row = await this.db.query.supplier.findFirst({ where: eq(supplier.id, id) });
    return row ? mapSupplierEntity(row) : null;
  }

  public async findSupplierBySlug(slug: string): Promise<SupplierEntity | null> {
    const row = await this.db.query.supplier.findFirst({ where: eq(supplier.slug, slug) });
    return row ? mapSupplierEntity(row) : null;
  }

  public async createSupplier(record: CreateSupplierRecord): Promise<SupplierSummary> {
    const [created] = await this.db
      .insert(supplier)
      .values({
        id: record.id,
        name: record.name,
        slug: record.slug,
        contact: record.contact,
        apiConfigEnc: record.apiConfigEnc,
        isActive: true,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create supplier");
    }
    return mapSupplierSummary(created);
  }

  public async updateSupplier(input: {
    id: string;
    name?: string | undefined;
    contact?: SupplierContact | null | undefined;
  }): Promise<SupplierSummary | null> {
    const [updated] = await this.db
      .update(supplier)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contact !== undefined ? { contact: input.contact } : {}),
        updatedAt: new Date(),
      })
      .where(eq(supplier.id, input.id))
      .returning();
    return updated ? mapSupplierSummary(updated) : null;
  }

  public async setSupplierActive(id: string, isActive: boolean): Promise<SupplierSummary | null> {
    const [updated] = await this.db
      .update(supplier)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(supplier.id, id))
      .returning();
    return updated ? mapSupplierSummary(updated) : null;
  }

  public async setSupplierApiConfig(id: string, apiConfigEnc: string): Promise<SupplierSummary | null> {
    const [updated] = await this.db
      .update(supplier)
      .set({ apiConfigEnc, updatedAt: new Date() })
      .where(eq(supplier.id, id))
      .returning();
    return updated ? mapSupplierSummary(updated) : null;
  }

  public async listFeeds(supplierId: string): Promise<SupplierFeedRecord[]> {
    const rows = await this.db.select().from(supplierFeed).where(eq(supplierFeed.supplierId, supplierId)).orderBy(supplierFeed.createdAt);
    return rows.map(mapFeed);
  }

  public async findFeedById(feedId: string): Promise<SupplierFeedRecord | null> {
    const row = await this.db.query.supplierFeed.findFirst({ where: eq(supplierFeed.id, feedId) });
    return row ? mapFeed(row) : null;
  }

  public async upsertFeed(record: UpsertFeedRecord): Promise<SupplierFeedRecord> {
    const existing = await this.db.query.supplierFeed.findFirst({ where: eq(supplierFeed.id, record.id) });
    const now = new Date();
    const [row] = existing
      ? await this.db
          .update(supplierFeed)
          .set({
            kind: record.kind,
            sourceUrl: record.sourceUrl,
            schedule: record.schedule,
            fieldMap: record.fieldMap,
            updatedAt: now,
          })
          .where(eq(supplierFeed.id, record.id))
          .returning()
      : await this.db
          .insert(supplierFeed)
          .values({
            id: record.id,
            supplierId: record.supplierId,
            kind: record.kind,
            sourceUrl: record.sourceUrl,
            schedule: record.schedule,
            fieldMap: record.fieldMap,
            status: "IDLE",
          })
          .returning();
    if (!row) {
      throw new Error("Failed to upsert supplier feed");
    }
    return mapFeed(row);
  }

  public async setFeedRunResult(input: {
    feedId: string;
    status: SupplierFeedStatus;
    summary: SupplierFeedRunSummary;
    lastRunAt: Date;
  }): Promise<void> {
    await this.db
      .update(supplierFeed)
      .set({
        status: input.status,
        lastRunAt: input.lastRunAt,
        lastRunSummary: input.summary as unknown as Record<string, number>,
        updatedAt: new Date(),
      })
      .where(eq(supplierFeed.id, input.feedId));
  }

  public async setFeedStatus(feedId: string, status: SupplierFeedStatus): Promise<void> {
    await this.db.update(supplierFeed).set({ status, updatedAt: new Date() }).where(eq(supplierFeed.id, feedId));
  }

  public async listMap(input: {
    supplierId: string;
    status?: SupplierSyncStatus | undefined;
    cursor?: string | undefined;
    limit: number;
  }): Promise<{ items: SupplierProductMapRecord[]; nextCursor: string | null }> {
    const conditions: SQL[] = [eq(supplierProductMap.supplierId, input.supplierId)];
    if (input.status !== undefined) conditions.push(eq(supplierProductMap.syncStatus, input.status));
    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      conditions.push(
        or(
          lt(supplierProductMap.createdAt, cursor.createdAt),
          and(eq(supplierProductMap.createdAt, cursor.createdAt), lt(supplierProductMap.id, cursor.id)),
        ) ?? sql`false`,
      );
    }
    const rows = await this.db
      .select()
      .from(supplierProductMap)
      .where(and(...conditions))
      .orderBy(desc(supplierProductMap.createdAt), desc(supplierProductMap.id))
      .limit(input.limit + 1);
    const visible = rows.slice(0, input.limit).map(mapMapRecord);
    const last = rows.length > input.limit ? rows[input.limit - 1] : null;
    return {
      items: visible,
      nextCursor: last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  public async findMapById(mapId: string): Promise<SupplierProductMapRecord | null> {
    const row = await this.db.query.supplierProductMap.findFirst({ where: eq(supplierProductMap.id, mapId) });
    return row ? mapMapRecord(row) : null;
  }

  public async findMapByExternalId(
    supplierId: string,
    externalId: string,
  ): Promise<(SupplierProductMapRecord & { contentHash: string | null }) | null> {
    const row = await this.db.query.supplierProductMap.findFirst({
      where: and(eq(supplierProductMap.supplierId, supplierId), eq(supplierProductMap.externalId, externalId)),
    });
    return row ? { ...mapMapRecord(row), contentHash: row.contentHash } : null;
  }

  public async findMapByVariantId(supplierId: string, variantId: string): Promise<SupplierProductMapRecord | null> {
    const row = await this.db.query.supplierProductMap.findFirst({
      where: and(eq(supplierProductMap.supplierId, supplierId), eq(supplierProductMap.variantId, variantId)),
    });
    return row ? mapMapRecord(row) : null;
  }

  public async findMapsByVariantIds(variantIds: string[]): Promise<SupplierProductMapRecord[]> {
    if (variantIds.length === 0) {
      return [];
    }
    const rows = await this.db.select().from(supplierProductMap).where(inArray(supplierProductMap.variantId, variantIds));
    return rows.map(mapMapRecord);
  }

  public async upsertMapRow(record: UpsertMapRowRecord): Promise<void> {
    await this.db
      .insert(supplierProductMap)
      .values({
        id: record.id,
        supplierId: record.supplierId,
        externalId: record.externalId,
        raw: record.raw,
        contentHash: record.contentHash,
        syncStatus: record.syncStatus,
        lastSeenAt: record.seenAt,
        syncedAt: record.synced ? record.seenAt : null,
      })
      .onConflictDoUpdate({
        target: [supplierProductMap.supplierId, supplierProductMap.externalId],
        set: {
          raw: record.raw,
          contentHash: record.contentHash,
          syncStatus: record.syncStatus,
          lastSeenAt: record.seenAt,
          ...(record.synced ? { syncedAt: record.seenAt } : {}),
        },
      });
  }

  public async linkMap(input: {
    mapId: string;
    variantId: string;
    syncStatus: SupplierSyncStatus;
  }): Promise<SupplierProductMapRecord | null> {
    const [updated] = await this.db
      .update(supplierProductMap)
      .set({ variantId: input.variantId, syncStatus: input.syncStatus, syncedAt: new Date() })
      .where(eq(supplierProductMap.id, input.mapId))
      .returning();
    return updated ? mapMapRecord(updated) : null;
  }

  public async markDiscontinuedNotSeenSince(supplierId: string, runStartedAt: Date): Promise<number> {
    const rows = await this.db
      .update(supplierProductMap)
      .set({ syncStatus: SupplierSyncStatus.DISCONTINUED })
      .where(
        and(
          eq(supplierProductMap.supplierId, supplierId),
          ne(supplierProductMap.syncStatus, SupplierSyncStatus.DISCONTINUED),
          or(lt(supplierProductMap.lastSeenAt, runStartedAt), sql`${supplierProductMap.lastSeenAt} IS NULL`) ?? sql`false`,
        ),
      )
      .returning({ id: supplierProductMap.id });
    return rows.length;
  }

  public async listOrderRefs(orderId: string): Promise<SupplierOrderRefRecord[]> {
    const rows = await this.db.select().from(supplierOrderRef).where(eq(supplierOrderRef.orderId, orderId));
    return rows.map(mapOrderRef);
  }

  public async findOrderRef(orderId: string, supplierId: string): Promise<SupplierOrderRefRecord | null> {
    const row = await this.db.query.supplierOrderRef.findFirst({
      where: and(eq(supplierOrderRef.orderId, orderId), eq(supplierOrderRef.supplierId, supplierId)),
    });
    return row ? mapOrderRef(row) : null;
  }

  public async findOrderRefByExternalOrderId(supplierId: string, externalOrderId: string): Promise<SupplierOrderRefRecord | null> {
    const row = await this.db.query.supplierOrderRef.findFirst({
      where: and(eq(supplierOrderRef.supplierId, supplierId), eq(supplierOrderRef.externalOrderId, externalOrderId)),
    });
    return row ? mapOrderRef(row) : null;
  }

  public async createOrderRef(record: {
    id: string;
    orderId: string;
    supplierId: string;
    idempotencyKey: string;
  }): Promise<SupplierOrderRefRecord> {
    const [created] = await this.db
      .insert(supplierOrderRef)
      .values({
        id: record.id,
        orderId: record.orderId,
        supplierId: record.supplierId,
        idempotencyKey: record.idempotencyKey,
        status: "PENDING",
        attempts: 0,
      })
      .onConflictDoNothing({ target: [supplierOrderRef.orderId, supplierOrderRef.supplierId] })
      .returning();
    if (created) {
      return mapOrderRef(created);
    }
    const existing = await this.findOrderRef(record.orderId, record.supplierId);
    if (!existing) {
      throw new Error("Failed to create supplier order ref");
    }
    return existing;
  }

  public async updateOrderRef(input: {
    id: string;
    status: SupplierForwardStatus;
    externalOrderId?: string | null | undefined;
    lastError?: string | null | undefined;
    incrementAttempts?: boolean | undefined;
  }): Promise<SupplierOrderRefRecord | null> {
    const [updated] = await this.db
      .update(supplierOrderRef)
      .set({
        status: input.status,
        ...(input.externalOrderId !== undefined ? { externalOrderId: input.externalOrderId } : {}),
        ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
        ...(input.incrementAttempts ? { attempts: sql`${supplierOrderRef.attempts} + 1` } : {}),
        updatedAt: new Date(),
      })
      .where(eq(supplierOrderRef.id, input.id))
      .returning();
    return updated ? mapOrderRef(updated) : null;
  }

  public async recordWebhookEvent(supplierId: string, eventId: string): Promise<boolean> {
    const rows = await this.db
      .insert(supplierWebhookEvent)
      .values({ id: uuidv7(), supplierId, eventId })
      .onConflictDoNothing({ target: [supplierWebhookEvent.supplierId, supplierWebhookEvent.eventId] })
      .returning({ id: supplierWebhookEvent.id });
    return rows.length > 0;
  }

  public async enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(outboxEvent).values({
      id: event.id,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      payload: event.payload,
    });
  }
}

const mapSupplierSummary = (row: typeof supplier.$inferSelect): SupplierSummary => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  contact: (row.contact as SupplierContact | null) ?? null,
  isActive: row.isActive,
  hasApiConfig: row.apiConfigEnc !== null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const mapSupplierEntity = (row: typeof supplier.$inferSelect): SupplierEntity => ({
  ...mapSupplierSummary(row),
  apiConfigEnc: row.apiConfigEnc,
});

const mapFeed = (row: typeof supplierFeed.$inferSelect): SupplierFeedRecord => ({
  id: row.id,
  supplierId: row.supplierId,
  kind: row.kind as SupplierFeedRecord["kind"],
  sourceUrl: row.sourceUrl,
  schedule: row.schedule,
  fieldMap: row.fieldMap,
  status: row.status as SupplierFeedRecord["status"],
  lastRunAt: row.lastRunAt?.toISOString() ?? null,
  lastRunSummary: (row.lastRunSummary as SupplierFeedRunSummary | null) ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const mapMapRecord = (row: typeof supplierProductMap.$inferSelect): SupplierProductMapRecord => ({
  id: row.id,
  supplierId: row.supplierId,
  externalId: row.externalId,
  variantId: row.variantId,
  syncStatus: row.syncStatus as SupplierProductMapRecord["syncStatus"],
  lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
  syncedAt: row.syncedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

const mapOrderRef = (row: typeof supplierOrderRef.$inferSelect): SupplierOrderRefRecord => ({
  id: row.id,
  orderId: row.orderId,
  supplierId: row.supplierId,
  externalOrderId: row.externalOrderId,
  status: row.status as SupplierOrderRefRecord["status"],
  attempts: row.attempts,
  lastError: row.lastError,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify({ createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString("base64url");

const decodeCursor = (cursor: string | undefined): Cursor | null => {
  if (!cursor) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const value = parsed as { createdAt?: unknown; id?: unknown };
    if (typeof value.createdAt !== "string" || typeof value.id !== "string") {
      return null;
    }
    const createdAt = new Date(value.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id: value.id };
  } catch {
    return null;
  }
};
