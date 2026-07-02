import { aiAlert, aiGeneration } from "@cloudcommerce/database";
import {
  AiAlertStatus,
  type AiAlertRecord,
  type AiGenerationKind,
  type AiGenerationStatus,
  type AiGenerationSummary,
} from "@cloudcommerce/types";
import { and, desc, eq, gte, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  AiRepository,
  CompleteGenerationRecord,
  CreateGenerationRecord,
  ListAlertsFilters,
  ListGenerationsFilters,
  UpsertAlertRecord,
} from "../../application/ports.js";

type Cursor = { createdAt: Date; id: string };

export class DrizzleAiRepository implements AiRepository {
  public constructor(private readonly db: Database) {}

  public async createGeneration(record: CreateGenerationRecord): Promise<void> {
    await this.db.insert(aiGeneration).values({
      id: record.id,
      kind: record.kind,
      targetType: record.targetType,
      targetId: record.targetId,
      promptRef: record.promptRef,
      status: "QUEUED",
      costEstimateMinor: record.costEstimateMinor,
      currency: "ARS",
      actorId: record.actorId,
    });
  }

  public async completeGeneration(record: CompleteGenerationRecord): Promise<void> {
    await this.db
      .update(aiGeneration)
      .set({
        status: record.status,
        completedAt: new Date(),
        ...(record.costEstimateMinor !== undefined ? { costEstimateMinor: record.costEstimateMinor } : {}),
        ...(record.errorCode !== undefined ? { errorCode: record.errorCode } : {}),
      })
      .where(eq(aiGeneration.id, record.id));
  }

  public async findGenerationById(id: string): Promise<AiGenerationSummary | null> {
    const row = await this.db.query.aiGeneration.findFirst({ where: eq(aiGeneration.id, id) });
    return row ? mapGeneration(row) : null;
  }

  public async findGenerationByPromptRef(promptRef: string, withinMinutes: number): Promise<AiGenerationSummary | null> {
    const since = new Date(Date.now() - withinMinutes * 60_000);
    const row = await this.db.query.aiGeneration.findFirst({
      where: and(eq(aiGeneration.promptRef, promptRef), gte(aiGeneration.createdAt, since)),
      orderBy: desc(aiGeneration.createdAt),
    });
    return row ? mapGeneration(row) : null;
  }

  public async listGenerations(filters: ListGenerationsFilters): Promise<{ items: AiGenerationSummary[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (filters.kind !== undefined) conditions.push(eq(aiGeneration.kind, filters.kind));
    if (filters.status !== undefined) conditions.push(eq(aiGeneration.status, filters.status));
    if (filters.targetId !== undefined) conditions.push(eq(aiGeneration.targetId, filters.targetId));
    if (filters.dateFrom !== undefined) conditions.push(gte(aiGeneration.createdAt, new Date(filters.dateFrom)));
    if (filters.dateTo !== undefined) conditions.push(lte(aiGeneration.createdAt, new Date(filters.dateTo)));
    const cursor = decodeCursor(filters.cursor);
    if (cursor) {
      conditions.push(
        or(
          lt(aiGeneration.createdAt, cursor.createdAt),
          and(eq(aiGeneration.createdAt, cursor.createdAt), lt(aiGeneration.id, cursor.id)),
        ) ?? sql`false`,
      );
    }
    const query = this.db
      .select()
      .from(aiGeneration)
      .$dynamic()
      .orderBy(desc(aiGeneration.createdAt), desc(aiGeneration.id))
      .limit(filters.limit + 1);
    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    const visible = rows.slice(0, filters.limit).map(mapGeneration);
    const last = rows.length > filters.limit ? rows[filters.limit - 1] : null;
    return {
      items: visible,
      nextCursor: last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  public async sumCostSince(actorId: string | null, since: Date): Promise<number> {
    const conditions: SQL[] = [gte(aiGeneration.createdAt, since)];
    conditions.push(actorId === null ? isNull(aiGeneration.actorId) : eq(aiGeneration.actorId, actorId));
    const [row] = await this.db
      .select({ total: sql<number>`coalesce(sum(${aiGeneration.costEstimateMinor}), 0)::int` })
      .from(aiGeneration)
      .where(and(...conditions));
    return row?.total ?? 0;
  }

  public async usageSummary(from: Date, to: Date): Promise<{
    totalCostMinor: number;
    count: number;
    byKind: Array<{ kind: AiGenerationKind; count: number; costMinor: number }>;
    byStatus: Array<{ status: AiGenerationStatus; count: number }>;
  }> {
    const range = and(gte(aiGeneration.createdAt, from), lte(aiGeneration.createdAt, to));
    const byKindRows = await this.db
      .select({
        kind: aiGeneration.kind,
        count: sql<number>`count(*)::int`,
        costMinor: sql<number>`coalesce(sum(${aiGeneration.costEstimateMinor}), 0)::int`,
      })
      .from(aiGeneration)
      .where(range)
      .groupBy(aiGeneration.kind);
    const byStatusRows = await this.db
      .select({
        status: aiGeneration.status,
        count: sql<number>`count(*)::int`,
      })
      .from(aiGeneration)
      .where(range)
      .groupBy(aiGeneration.status);
    return {
      totalCostMinor: byKindRows.reduce((sum, row) => sum + row.costMinor, 0),
      count: byKindRows.reduce((sum, row) => sum + row.count, 0),
      byKind: byKindRows.map((row) => ({ kind: row.kind as AiGenerationKind, count: row.count, costMinor: row.costMinor })),
      byStatus: byStatusRows.map((row) => ({ status: row.status as AiGenerationStatus, count: row.count })),
    };
  }

  public async upsertOpenAlert(record: UpsertAlertRecord): Promise<AiAlertRecord> {
    if (record.dedupeKey) {
      const existing = await this.db.query.aiAlert.findFirst({
        where: and(eq(aiAlert.dedupeKey, record.dedupeKey), eq(aiAlert.status, AiAlertStatus.OPEN)),
      });
      if (existing) {
        const [updated] = await this.db
          .update(aiAlert)
          .set({ payload: record.payload })
          .where(eq(aiAlert.id, existing.id))
          .returning();
        return mapAlert(updated ?? existing);
      }
    }
    const [created] = await this.db
      .insert(aiAlert)
      .values({
        id: record.id,
        kind: record.kind,
        payload: record.payload,
        dedupeKey: record.dedupeKey,
        status: "OPEN",
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create AI alert");
    }
    return mapAlert(created);
  }

  public async findAlertById(id: string): Promise<AiAlertRecord | null> {
    const row = await this.db.query.aiAlert.findFirst({ where: eq(aiAlert.id, id) });
    return row ? mapAlert(row) : null;
  }

  public async listAlerts(filters: ListAlertsFilters): Promise<{ items: AiAlertRecord[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (filters.kind !== undefined) conditions.push(eq(aiAlert.kind, filters.kind));
    if (filters.status !== undefined) conditions.push(eq(aiAlert.status, filters.status));
    const cursor = decodeCursor(filters.cursor);
    if (cursor) {
      conditions.push(
        or(lt(aiAlert.createdAt, cursor.createdAt), and(eq(aiAlert.createdAt, cursor.createdAt), lt(aiAlert.id, cursor.id))) ?? sql`false`,
      );
    }
    const query = this.db
      .select()
      .from(aiAlert)
      .$dynamic()
      .orderBy(desc(aiAlert.createdAt), desc(aiAlert.id))
      .limit(filters.limit + 1);
    const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    const visible = rows.slice(0, filters.limit).map(mapAlert);
    const last = rows.length > filters.limit ? rows[filters.limit - 1] : null;
    return {
      items: visible,
      nextCursor: last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }

  public async setAlertStatus(input: {
    alertId: string;
    status: AiAlertStatus;
    resolvedBy: string | null;
    note: string | null;
  }): Promise<AiAlertRecord | null> {
    const terminal = input.status === AiAlertStatus.RESOLVED || input.status === AiAlertStatus.DISMISSED;
    const [updated] = await this.db
      .update(aiAlert)
      .set({
        status: input.status,
        resolutionNote: input.note,
        resolvedBy: input.resolvedBy,
        resolvedAt: terminal ? new Date() : null,
      })
      .where(eq(aiAlert.id, input.alertId))
      .returning();
    return updated ? mapAlert(updated) : null;
  }
}

const mapGeneration = (row: typeof aiGeneration.$inferSelect): AiGenerationSummary => ({
  id: row.id,
  kind: row.kind as AiGenerationKind,
  targetType: row.targetType as AiGenerationSummary["targetType"],
  targetId: row.targetId,
  status: row.status as AiGenerationStatus,
  costEstimateMinor: row.costEstimateMinor,
  currency: row.currency as "ARS",
  actorId: row.actorId,
  createdAt: row.createdAt.toISOString(),
  completedAt: row.completedAt?.toISOString() ?? null,
});

const mapAlert = (row: typeof aiAlert.$inferSelect): AiAlertRecord => ({
  id: row.id,
  kind: row.kind as AiAlertRecord["kind"],
  payload: row.payload,
  status: row.status as AiAlertRecord["status"],
  createdAt: row.createdAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
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
