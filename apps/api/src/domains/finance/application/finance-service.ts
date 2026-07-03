import {
  DocumentStatus,
  OrderStatus,
  type Actor,
  type Currency,
  type DocumentDetail,
  type DocumentDownload,
  type DocumentListResult,
  type DocumentSummary,
  type FinanceKpis,
  type FinancePeriodReport,
  type Money,
} from "@cloudcommerce/types";
import type {
  DownloadDocumentInput,
  FinanceKpisQuery,
  FinancePeriodReportQuery,
  GenerateDocumentInput,
  GetDocumentInput,
  ListDocumentsInput,
  RecomputePeriodSnapshotInput,
  RegenerateDocumentInput,
} from "@cloudcommerce/validators";
import { createHash } from "node:crypto";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { FinanceDomainError } from "../../../shared/errors/domain-error.js";
import { formatDocumentDisplayNumber } from "../domain/document-number.js";
import { canManageFinance, canReadFinanceDocuments, canViewMargin, requiresDocumentReason } from "../domain/finance-permissions.js";
import { parseArgentinaMonthPeriod, periodsBetween, previousPeriod } from "../domain/period.js";
import type { FinanceDocumentEntity, FinanceRepository, RequestAuditContext } from "./finance-repository.js";
import type { DocumentStoragePort, NumberSequencePort, OrdersReadModelPort, PdfRendererPort, PeriodAggregate } from "./ports.js";

type RequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
  reason?: string | null;
  idempotencyKey?: string | null;
};

export class FinanceService {
  public constructor(
    private readonly repository: FinanceRepository,
    private readonly orders: OrdersReadModelPort,
    private readonly renderer: PdfRendererPort,
    private readonly storage: DocumentStoragePort,
    private readonly sequence: NumberSequencePort,
  ) {}

  public async generateDocument(
    actor: Actor,
    input: GenerateDocumentInput,
    context: RequestContext,
  ): Promise<Result<DocumentDetail, FinanceDomainError>> {
    if (!canManageFinance(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const order = await this.orders.getOrderForDocument(input.orderId);
    if (!order) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    if ([OrderStatus.DRAFT, OrderStatus.CANCELLED].includes(order.status)) {
      return err({ type: "INVALID_ORDER_STATE" });
    }
    const series = input.series ?? "A";
    const actorId = actor.kind === "admin" ? actor.userId : "00000000-0000-0000-0000-000000000000";
    const requestHash = this.hashPayload(input);
    const existing = await this.repository.findExistingGeneration({
      idempotencyKey: context.idempotencyKey ?? null,
      requestHash,
      actorId,
      type: input.type,
      orderId: order.id,
    });
    if (existing) {
      switch (existing.type) {
        case "REUSED":
          return ok(this.presentDetail(existing.document));
        case "IDEMPOTENCY_CONFLICT":
          return err({ type: "IDEMPOTENCY_CONFLICT" });
        case "DOCUMENT_ALREADY_ISSUED":
          return err({ type: "DOCUMENT_ALREADY_ISSUED" });
      }
    }
    const issuedAt = new Date();
    const number = await this.sequence.nextNumber({ type: input.type, series });
    const displayNumber = formatDocumentDisplayNumber(input.type, number);
    const rendered = await this.renderer.render({ type: input.type, series, order, displayNumber, issuedAt });
    const storageKey = `documents/${input.type.toLowerCase()}/${series}/${displayNumber}.ccdoc`;
    const stored = await this.storage.putDocument({ storageKey, bytes: rendered.bytes });
    const result = await this.repository.createAvailableDocument(
      {
        idempotencyKey: context.idempotencyKey ?? null,
        requestHash,
        type: input.type,
        series,
        number,
        displayNumber,
        orderId: order.id,
        customerId: order.customerId,
        totalMinor: order.totalMinor,
        currency: order.currency,
        contentHash: rendered.contentHash,
        pdfStorageKey: stored.storageKey,
        pdfChecksum: stored.checksum,
        relatedDocumentId: input.relatedDocumentId ?? null,
        createdBy: actorId,
        issuedAt,
      },
      this.audit(actor, context, "finance.document.generate"),
    );
    switch (result.type) {
      case "CREATED":
      case "REUSED":
        return ok(this.presentDetail(result.document));
      case "IDEMPOTENCY_CONFLICT":
        return err({ type: "IDEMPOTENCY_CONFLICT" });
      case "DOCUMENT_ALREADY_ISSUED":
        return err({ type: "DOCUMENT_ALREADY_ISSUED" });
    }
  }

  public async regenerateDocument(
    actor: Actor,
    input: RegenerateDocumentInput,
  ): Promise<Result<DocumentDetail, FinanceDomainError>> {
    if (!canManageFinance(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const document = await this.repository.getDocument(input.documentId);
    if (!document) {
      return err({ type: "DOCUMENT_NOT_FOUND" });
    }
    if (!document.orderId || !document.issuedAt) {
      return err({ type: "DOCUMENT_NOT_READY" });
    }
    const order = await this.orders.getOrderForDocument(document.orderId);
    if (!order) {
      return err({ type: "ORDER_NOT_FOUND" });
    }
    const rendered = await this.renderer.render({
      type: document.type,
      series: document.series,
      order,
      displayNumber: document.displayNumber,
      issuedAt: document.issuedAt,
    });
    const storageKey = document.pdfStorageKey ?? `documents/${document.type.toLowerCase()}/${document.series}/${document.displayNumber}.ccdoc`;
    const stored = await this.storage.putDocument({ storageKey, bytes: rendered.bytes });
    const updated = await this.repository.replaceDocumentFile({
      documentId: document.id,
      pdfStorageKey: stored.storageKey,
      pdfChecksum: stored.checksum,
      contentHash: rendered.contentHash,
    });
    return updated ? ok(this.presentDetail(updated)) : err({ type: "DOCUMENT_NOT_FOUND" });
  }

  public async getDocument(
    actor: Actor,
    input: GetDocumentInput,
  ): Promise<Result<DocumentDetail, FinanceDomainError>> {
    if (!canReadFinanceDocuments(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (requiresDocumentReason(actor) && !input.reason?.trim()) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const document = await this.repository.getDocument(input.documentId);
    if (!document) {
      return err({ type: "DOCUMENT_NOT_FOUND" });
    }
    return ok(this.presentDetail(document));
  }

  public async listDocuments(actor: Actor, input: ListDocumentsInput): Promise<Result<DocumentListResult, FinanceDomainError>> {
    if (!canReadFinanceDocuments(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const query: Parameters<FinanceRepository["listDocuments"]>[0] = { limit: input.limit };
    if (input.orderId !== undefined) query.orderId = input.orderId;
    if (input.customerId !== undefined) query.customerId = input.customerId;
    if (input.type !== undefined) query.type = input.type;
    if (input.cursor !== undefined) query.cursor = input.cursor;
    const result = await this.repository.listDocuments(query);
    return ok({ items: result.rows.map((document) => this.presentSummary(document)), nextCursor: result.nextCursor });
  }

  public async getDocumentDownloadUrl(
    actor: Actor,
    input: DownloadDocumentInput,
    context: RequestContext,
  ): Promise<Result<DocumentDownload, FinanceDomainError>> {
    if (!canReadFinanceDocuments(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (requiresDocumentReason(actor) && !input.reason?.trim()) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const document = await this.repository.getDocument(input.documentId);
    if (!document) {
      return err({ type: "DOCUMENT_NOT_FOUND" });
    }
    if (document.status !== DocumentStatus.AVAILABLE || !document.pdfStorageKey) {
      return err({ type: "DOCUMENT_NOT_READY" });
    }
    const filename = `${document.displayNumber}.ccdoc`;
    const signed = await this.storage.getSignedDownloadUrl({ storageKey: document.pdfStorageKey, filename, ttlSeconds: 300 });
    await this.repository.recordDownload({
      documentId: document.id,
      actorId: actor.kind === "admin" ? actor.userId : null,
      reason: input.reason ?? null,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    return ok({ url: signed.url, expiresAt: signed.expiresAt, filename });
  }

  public async getPeriodReport(
    actor: Actor,
    input: FinancePeriodReportQuery,
  ): Promise<Result<FinancePeriodReport, FinanceDomainError>> {
    if (!canViewMargin(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const parsed = parseArgentinaMonthPeriod(input.period);
    if (!parsed) {
      return err({ type: "UPSTREAM_UNAVAILABLE" });
    }
    const aggregate = await this.orders.getPeriodAggregates({ period: input.period, currency: input.currency });
    const snapshot = await this.repository.upsertPeriodSnapshot({
      period: aggregate.period,
      currency: aggregate.currency,
      revenueMinor: aggregate.revenueMinor,
      costMinor: aggregate.costMinor,
      marginMinor: aggregate.marginMinor,
      ordersCount: aggregate.ordersCount,
      sourceVersion: "orders.v1",
      isStale: false,
    });
    const comparePeriod = input.compareTo === "previous" ? previousPeriod(input.period) : input.compareTo ?? null;
    const comparisonAggregate = comparePeriod
      ? await this.orders.getPeriodAggregates({ period: comparePeriod, currency: input.currency })
      : null;
    return ok(this.presentPeriodReport(aggregate, snapshot.computedAt, false, comparisonAggregate));
  }

  public async getKpis(actor: Actor, input: FinanceKpisQuery): Promise<Result<FinanceKpis, FinanceDomainError>> {
    if (!canViewMargin(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const periods = this.resolveKpiPeriods(input);
    const aggregates = await Promise.all(periods.map((period) => this.orders.getPeriodAggregates({ period, currency: input.currency })));
    const total = aggregates.reduce(
      (acc, item) => ({
        revenueMinor: acc.revenueMinor + item.revenueMinor,
        costMinor: acc.costMinor + item.costMinor,
        marginMinor: acc.marginMinor + item.marginMinor,
        ordersCount: acc.ordersCount + item.ordersCount,
      }),
      { revenueMinor: 0, costMinor: 0, marginMinor: 0, ordersCount: 0 },
    );
    return ok({
      range: typeof input.range === "string" ? input.range : `${input.range.from}:${input.range.to}`,
      totalRevenue: money(total.revenueMinor, input.currency),
      totalCost: money(total.costMinor, input.currency),
      totalMargin: money(total.marginMinor, input.currency),
      marginPct: total.revenueMinor === 0 ? 0 : total.marginMinor / total.revenueMinor,
      ordersCount: total.ordersCount,
      avgTicket: money(total.ordersCount === 0 ? 0 : Math.round(total.revenueMinor / total.ordersCount), input.currency),
      trend: aggregates.map((aggregate) => ({
        period: aggregate.period,
        revenue: money(aggregate.revenueMinor, aggregate.currency),
        margin: money(aggregate.marginMinor, aggregate.currency),
      })),
    });
  }

  public async recomputePeriodSnapshot(
    actor: Actor,
    input: RecomputePeriodSnapshotInput,
  ): Promise<Result<FinancePeriodReport, FinanceDomainError>> {
    if (!canManageFinance(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const aggregate = await this.orders.getPeriodAggregates({ period: input.period, currency: input.currency });
    const snapshot = await this.repository.upsertPeriodSnapshot({
      period: aggregate.period,
      currency: aggregate.currency,
      revenueMinor: aggregate.revenueMinor,
      costMinor: aggregate.costMinor,
      marginMinor: aggregate.marginMinor,
      ordersCount: aggregate.ordersCount,
      sourceVersion: "orders.v1",
      isStale: false,
    });
    return ok(this.presentPeriodReport(aggregate, snapshot.computedAt, false, null));
  }

  private presentSummary(document: FinanceDocumentEntity): DocumentSummary {
    return {
      id: document.id,
      type: document.type,
      series: document.series,
      displayNumber: document.displayNumber,
      status: document.status,
      orderId: document.orderId,
      customerId: document.customerId,
      total: money(document.totalMinor, document.currency),
      issuedAt: document.issuedAt,
      createdAt: document.createdAt,
    };
  }

  private presentDetail(document: FinanceDocumentEntity): DocumentDetail {
    return {
      ...this.presentSummary(document),
      relatedDocumentId: document.relatedDocumentId,
      updatedAt: document.updatedAt,
    };
  }

  private presentPeriodReport(
    aggregate: PeriodAggregate,
    computedAt: Date,
    fromCache: boolean,
    comparison: PeriodAggregate | null,
  ): FinancePeriodReport {
    const warnings = aggregate.linesMissingCost > 0 ? [`${aggregate.linesMissingCost} lineas no tienen costo snapshot.`] : [];
    return {
      period: aggregate.period,
      currency: aggregate.currency,
      revenue: money(aggregate.revenueMinor, aggregate.currency),
      cost: money(aggregate.costMinor, aggregate.currency),
      margin: money(aggregate.marginMinor, aggregate.currency),
      marginPct: aggregate.revenueMinor === 0 ? 0 : aggregate.marginMinor / aggregate.revenueMinor,
      ordersCount: aggregate.ordersCount,
      avgTicket: money(aggregate.ordersCount === 0 ? 0 : Math.round(aggregate.revenueMinor / aggregate.ordersCount), aggregate.currency),
      linesMissingCost: aggregate.linesMissingCost,
      warnings,
      comparison: comparison
        ? {
            period: comparison.period,
            revenueDeltaPct: deltaPct(aggregate.revenueMinor, comparison.revenueMinor),
            marginDeltaPct: deltaPct(aggregate.marginMinor, comparison.marginMinor),
            ordersDeltaPct: deltaPct(aggregate.ordersCount, comparison.ordersCount),
          }
        : null,
      computedAt,
      fromCache,
    };
  }

  private resolveKpiPeriods(input: FinanceKpisQuery): string[] {
    const now = new Date();
    const current = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    if (typeof input.range !== "string") {
      return periodsBetween(input.range.from, input.range.to);
    }
    if (input.range === "ytd") {
      return periodsBetween(`${now.getUTCFullYear()}-01`, current);
    }
    if (input.range === "last-30d") {
      const previous = new Date(now);
      previous.setUTCMonth(previous.getUTCMonth() - 1);
      return periodsBetween(`${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`, current);
    }
    return [current];
  }

  private hashPayload(input: GenerateDocumentInput): string {
    return createHash("sha256")
      .update(JSON.stringify({ type: input.type, orderId: input.orderId, series: input.series ?? "A", relatedDocumentId: input.relatedDocumentId ?? null }))
      .digest("hex");
  }

  private audit(actor: Actor, context: RequestContext, reason: string): RequestAuditContext {
    return {
      actorId: actor.kind === "admin" ? actor.userId : null,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      reason: context.reason ?? reason,
    };
  }
}

const money = (amountMinor: number, currency: Currency): Money => ({ amountMinor, currency });

const deltaPct = (current: number, previous: number): number | null => {
  if (previous === 0) {
    return null;
  }
  return (current - previous) / previous;
};
