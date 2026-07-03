import {
  auditLog,
  commercialDocument,
  documentDownload,
  documentSequence,
  financePeriodSnapshot,
  idempotencyKey,
  outboxEvent,
} from "@cloudcommerce/database";
import { DocumentStatus, type Currency, type DocumentType } from "@cloudcommerce/types";
import { and, desc, eq, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  CreateAvailableDocumentRecord,
  CreateAvailableDocumentResult,
  ExistingDocumentGenerationResult,
  FinanceDocumentEntity,
  FinancePeriodSnapshotEntity,
  FinanceRepository,
  ListDocumentsQuery,
  RequestAuditContext,
} from "../../application/finance-repository.js";
import type { NumberSequencePort } from "../../application/ports.js";

type DocumentListCursor = {
  createdAt: string;
  id: string;
};

export class DrizzleFinanceRepository implements FinanceRepository, NumberSequencePort {
  private readonly idempotencyRoute = "finance.generateDocument";

  public constructor(private readonly db: Database) {}

  public async findExistingGeneration(input: {
    idempotencyKey: string | null;
    requestHash: string;
    actorId: string;
    type: DocumentType;
    orderId: string;
  }): Promise<ExistingDocumentGenerationResult | null> {
    if (input.idempotencyKey) {
      const existingIdempotency = await this.db.query.idempotencyKey.findFirst({
        where: and(
          eq(idempotencyKey.route, this.idempotencyRoute),
          eq(idempotencyKey.key, input.idempotencyKey),
          eq(idempotencyKey.actorId, input.actorId),
        ),
      });
      if (existingIdempotency) {
        if (existingIdempotency.requestHash !== input.requestHash) {
          return { type: "IDEMPOTENCY_CONFLICT" };
        }
        if (existingIdempotency.responseRefId) {
          const document = await this.getDocument(existingIdempotency.responseRefId);
          return document ? { type: "REUSED", document } : { type: "IDEMPOTENCY_CONFLICT" };
        }
        return { type: "IDEMPOTENCY_CONFLICT" };
      }
    }
    const existingAvailable = await this.db.query.commercialDocument.findFirst({
      where: and(
        eq(commercialDocument.type, input.type),
        eq(commercialDocument.orderId, input.orderId),
        eq(commercialDocument.status, DocumentStatus.AVAILABLE),
      ),
      columns: { id: true },
    });
    if (existingAvailable) {
      return { type: "DOCUMENT_ALREADY_ISSUED" };
    }
    return null;
  }

  public async nextNumber(input: { type: DocumentType; series: string }): Promise<number> {
    const [row] = await this.db
      .insert(documentSequence)
      .values({
        id: uuidv7(),
        type: input.type,
        series: input.series,
        nextNumber: 2,
      })
      .onConflictDoUpdate({
        target: [documentSequence.type, documentSequence.series],
        set: {
          nextNumber: sql`${documentSequence.nextNumber} + 1`,
        },
      })
      .returning({ nextNumber: documentSequence.nextNumber });
    if (!row) {
      throw new Error("Failed to reserve document number");
    }
    return row.nextNumber - 1;
  }

  public async createAvailableDocument(
    input: CreateAvailableDocumentRecord,
    audit: RequestAuditContext,
  ): Promise<CreateAvailableDocumentResult> {
    const result = await this.db.transaction(async (tx) => {
      const existingIdempotency = input.idempotencyKey
        ? await tx.query.idempotencyKey.findFirst({
            where: and(
              eq(idempotencyKey.route, this.idempotencyRoute),
              eq(idempotencyKey.key, input.idempotencyKey),
              eq(idempotencyKey.actorId, input.createdBy),
            ),
          })
        : null;
      if (existingIdempotency) {
        if (existingIdempotency.requestHash !== input.requestHash) {
          return { type: "IDEMPOTENCY_CONFLICT" as const };
        }
        if (existingIdempotency.responseRefId) {
          return { type: "REUSED" as const, documentId: existingIdempotency.responseRefId };
        }
        return { type: "IDEMPOTENCY_CONFLICT" as const };
      }

      const existingAvailable = await tx.query.commercialDocument.findFirst({
        where: and(
          eq(commercialDocument.type, input.type),
          eq(commercialDocument.orderId, input.orderId),
          eq(commercialDocument.status, DocumentStatus.AVAILABLE),
        ),
        columns: { id: true },
      });
      if (existingAvailable) {
        return { type: "DOCUMENT_ALREADY_ISSUED" as const };
      }

      const [created] = await tx
        .insert(commercialDocument)
        .values({
          id: uuidv7(),
          type: input.type,
          series: input.series,
          number: input.number,
          displayNumber: input.displayNumber,
          orderId: input.orderId,
          customerId: input.customerId,
          status: DocumentStatus.AVAILABLE,
          issuedAt: input.issuedAt,
          totalMinor: input.totalMinor,
          currency: input.currency,
          pdfStorageKey: input.pdfStorageKey,
          pdfChecksum: input.pdfChecksum,
          contentHash: input.contentHash,
          relatedDocumentId: input.relatedDocumentId,
          createdBy: input.createdBy,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create commercial document");
      }
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "finance.document.generate",
        resourceType: "commercial_document",
        resourceId: created.id,
        before: null,
        after: { type: input.type, orderId: input.orderId, displayNumber: input.displayNumber },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "finance",
        aggregateId: created.id,
        eventType: "DocumentGenerated",
        payload: { documentId: created.id, orderId: input.orderId, type: input.type },
      });
      if (input.idempotencyKey) {
        await tx.insert(idempotencyKey).values({
          id: uuidv7(),
          key: input.idempotencyKey,
          route: this.idempotencyRoute,
          actorId: input.createdBy,
          requestHash: input.requestHash,
          responseStatus: 201,
          responseRefType: "commercial_document",
          responseRefId: created.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }
      return { type: "CREATED" as const, documentId: created.id };
    });

    if (result.type === "IDEMPOTENCY_CONFLICT" || result.type === "DOCUMENT_ALREADY_ISSUED") {
      return result;
    }
    const document = await this.getDocument(result.documentId);
    if (!document) {
      throw new Error("Created document could not be loaded");
    }
    return { type: result.type, document };
  }

  public async replaceDocumentFile(input: {
    documentId: string;
    pdfStorageKey: string;
    pdfChecksum: string;
    contentHash: string;
  }): Promise<FinanceDocumentEntity | null> {
    const [row] = await this.db
      .update(commercialDocument)
      .set({
        pdfStorageKey: input.pdfStorageKey,
        pdfChecksum: input.pdfChecksum,
        contentHash: input.contentHash,
        updatedAt: new Date(),
      })
      .where(eq(commercialDocument.id, input.documentId))
      .returning();
    return row ? this.mapDocument(row) : null;
  }

  public async getDocument(documentId: string): Promise<FinanceDocumentEntity | null> {
    const row = await this.db.query.commercialDocument.findFirst({ where: eq(commercialDocument.id, documentId) });
    return row ? this.mapDocument(row) : null;
  }

  public async listDocuments(input: ListDocumentsQuery): Promise<{ rows: FinanceDocumentEntity[]; nextCursor: string | null }> {
    const conditions: SQL[] = [];
    if (input.orderId !== undefined) conditions.push(eq(commercialDocument.orderId, input.orderId));
    if (input.customerId !== undefined) conditions.push(eq(commercialDocument.customerId, input.customerId));
    if (input.type !== undefined) conditions.push(eq(commercialDocument.type, input.type));
    const cursor = this.decodeCursor(input.cursor);
    if (cursor) {
      const cursorDate = new Date(cursor.createdAt);
      if (!Number.isNaN(cursorDate.getTime())) {
        conditions.push(
          or(
            lt(commercialDocument.createdAt, cursorDate),
            and(eq(commercialDocument.createdAt, cursorDate), lt(commercialDocument.id, cursor.id)),
          ) ?? sql`false`,
        );
      }
    }
    const rows = conditions.length > 0
      ? await this.db
          .select()
          .from(commercialDocument)
          .where(and(...conditions))
          .orderBy(desc(commercialDocument.createdAt), desc(commercialDocument.id))
          .limit(input.limit + 1)
      : await this.db
          .select()
          .from(commercialDocument)
          .orderBy(desc(commercialDocument.createdAt), desc(commercialDocument.id))
          .limit(input.limit + 1);
    const visibleRows = rows.slice(0, input.limit).map((row) => this.mapDocument(row));
    const lastRow = visibleRows[visibleRows.length - 1];
    return {
      rows: visibleRows,
      nextCursor: rows.length > input.limit && lastRow ? this.encodeCursor(lastRow) : null,
    };
  }

  public async recordDownload(input: {
    documentId: string;
    actorId: string | null;
    reason: string | null;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.db.insert(documentDownload).values({
      id: uuidv7(),
      documentId: input.documentId,
      actorId: input.actorId,
      actorType: "admin",
      reason: input.reason,
      ip: input.ip,
      userAgent: input.userAgent,
    });
  }

  public async upsertPeriodSnapshot(
    input: Omit<FinancePeriodSnapshotEntity, "id" | "computedAt">,
  ): Promise<FinancePeriodSnapshotEntity> {
    const [row] = await this.db
      .insert(financePeriodSnapshot)
      .values({
        id: uuidv7(),
        period: input.period,
        currency: input.currency,
        revenueMinor: input.revenueMinor,
        costMinor: input.costMinor,
        marginMinor: input.marginMinor,
        ordersCount: input.ordersCount,
        sourceVersion: input.sourceVersion,
        isStale: input.isStale,
      })
      .onConflictDoUpdate({
        target: [financePeriodSnapshot.period, financePeriodSnapshot.currency],
        set: {
          revenueMinor: input.revenueMinor,
          costMinor: input.costMinor,
          marginMinor: input.marginMinor,
          ordersCount: input.ordersCount,
          computedAt: new Date(),
          sourceVersion: input.sourceVersion,
          isStale: input.isStale,
        },
      })
      .returning();
    if (!row) {
      throw new Error("Failed to upsert finance period snapshot");
    }
    return this.mapSnapshot(row);
  }

  public async getPeriodSnapshot(period: string, currency: Currency): Promise<FinancePeriodSnapshotEntity | null> {
    const row = await this.db.query.financePeriodSnapshot.findFirst({
      where: and(eq(financePeriodSnapshot.period, period), eq(financePeriodSnapshot.currency, currency)),
    });
    return row ? this.mapSnapshot(row) : null;
  }

  private mapDocument(row: typeof commercialDocument.$inferSelect): FinanceDocumentEntity {
    return {
      id: row.id,
      type: row.type,
      series: row.series,
      number: row.number,
      displayNumber: row.displayNumber,
      orderId: row.orderId,
      customerId: row.customerId,
      status: row.status,
      issuedAt: row.issuedAt,
      totalMinor: row.totalMinor,
      currency: this.currency(row.currency),
      pdfStorageKey: row.pdfStorageKey,
      pdfChecksum: row.pdfChecksum,
      contentHash: row.contentHash,
      relatedDocumentId: row.relatedDocumentId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapSnapshot(row: typeof financePeriodSnapshot.$inferSelect): FinancePeriodSnapshotEntity {
    return {
      id: row.id,
      period: row.period,
      currency: this.currency(row.currency),
      revenueMinor: row.revenueMinor,
      costMinor: row.costMinor,
      marginMinor: row.marginMinor,
      ordersCount: row.ordersCount,
      computedAt: row.computedAt,
      sourceVersion: row.sourceVersion,
      isStale: row.isStale,
    };
  }

  private encodeCursor(row: FinanceDocumentEntity): string {
    return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id })).toString("base64url");
  }

  private decodeCursor(cursor: string | undefined): DocumentListCursor | null {
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
      return { createdAt: value.createdAt, id: value.id };
    } catch {
      return null;
    }
  }

  private currency(value: string): Currency {
    return value === "USD" ? "USD" : "ARS";
  }
}
