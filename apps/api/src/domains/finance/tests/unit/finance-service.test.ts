import { AdminRole, DocumentStatus, DocumentType, OrderStatus, type Actor, type Currency } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { formatDocumentDisplayNumber } from "../../domain/document-number.js";
import type {
  CreateAvailableDocumentRecord,
  CreateAvailableDocumentResult,
  FinanceDocumentEntity,
  FinancePeriodSnapshotEntity,
  FinanceRepository,
  ListDocumentsQuery,
  RequestAuditContext,
} from "../../application/finance-repository.js";
import { FinanceService } from "../../application/finance-service.js";
import type { DocumentStoragePort, NumberSequencePort, OrdersReadModelPort, PdfRendererPort, RenderedDocument } from "../../application/ports.js";
import type { OrderDocumentSource, PeriodAggregate } from "../../application/ports.js";

const now = new Date("2026-07-01T12:00:00.000Z");
const orderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const customerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const documentId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";

describe("Finance document numbers", () => {
  it("formats display numbers by document type", () => {
    expect(formatDocumentDisplayNumber(DocumentType.REMITO, 1)).toBe("R-0001");
    expect(formatDocumentDisplayNumber(DocumentType.FACTURA, 2)).toBe("FA-0002");
    expect(formatDocumentDisplayNumber(DocumentType.NOTA_CREDITO, 1)).toBe("NC-0001");
  });
});

describe("FinanceService", () => {
  it("generates an available deterministic document for a valid order", async () => {
    const repository = new FakeFinanceRepository();
    const service = newService(repository);

    const result = await service.generateDocument(
      admin(AdminRole.FINANCE),
      { type: DocumentType.REMITO, orderId },
      { ...requestContext, idempotencyKey: "doc-1" },
    );

    expect(result.ok).toBe(true);
    expect(repository.created?.displayNumber).toBe("R-0001");
    if (result.ok) {
      expect(result.value.status).toBe(DocumentStatus.AVAILABLE);
      expect(result.value.displayNumber).toBe("R-0001");
    }
  });

  it("does not emit documents for cancelled orders", async () => {
    const service = newService(new FakeFinanceRepository(), { orderStatus: OrderStatus.CANCELLED });

    const result = await service.generateDocument(admin(AdminRole.ADMIN), { type: DocumentType.REMITO, orderId }, requestContext);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("INVALID_ORDER_STATE");
    }
  });

  it("computes period revenue, cost, margin and guards divisions by zero", async () => {
    const service = newService(new FakeFinanceRepository(), {
      aggregate: {
        period: "2026-07",
        currency: "ARS",
        revenueMinor: 0,
        costMinor: 0,
        marginMinor: 0,
        ordersCount: 0,
        linesMissingCost: 0,
      },
    });

    const result = await service.getPeriodReport(admin(AdminRole.FINANCE), { period: "2026-07", currency: "ARS" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revenue.amountMinor).toBe(0);
      expect(result.value.cost.amountMinor).toBe(0);
      expect(result.value.margin.amountMinor).toBe(0);
      expect(result.value.marginPct).toBe(0);
      expect(result.value.avgTicket.amountMinor).toBe(0);
    }
  });

  it("rejects margin reports for support and catalog roles", async () => {
    const service = newService(new FakeFinanceRepository());

    const support = await service.getPeriodReport(admin(AdminRole.SUPPORT), { period: "2026-07", currency: "ARS" });
    const catalog = await service.getPeriodReport(admin(AdminRole.CATALOG_MANAGER), { period: "2026-07", currency: "ARS" });

    expect(support.ok).toBe(false);
    expect(catalog.ok).toBe(false);
    if (!support.ok) expect(support.error.type).toBe("FORBIDDEN");
    if (!catalog.ok) expect(catalog.error.type).toBe("FORBIDDEN");
  });
});

const newService = (
  repository: FinanceRepository,
  options: { orderStatus?: OrderStatus; aggregate?: PeriodAggregate } = {},
): FinanceService =>
  new FinanceService(
    repository,
    new FakeOrdersReadModel(options.orderStatus ?? OrderStatus.CONFIRMED, options.aggregate),
    new FakeRenderer(),
    new FakeStorage(),
    new FakeSequence(),
  );

const admin = (role: AdminRole): Actor => ({
  kind: "admin",
  userId: "admin-user",
  role,
  sessionId: "session",
});

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "request-id",
};

class FakeOrdersReadModel implements OrdersReadModelPort {
  public constructor(
    private readonly status: OrderStatus,
    private readonly aggregate?: PeriodAggregate,
  ) {}

  public async getOrderForDocument(): Promise<OrderDocumentSource | null> {
    return {
      id: orderId,
      orderNumber: "ORD-2026-000001",
      customerId,
      status: this.status,
      currency: "ARS",
      totalMinor: 224_900,
      confirmedAt: now,
      createdAt: now,
      lines: [
        {
          variantId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
          productTitle: "Smartphone Demo",
          sku: "DEMO",
          quantity: 2,
          unitPriceMinor: 100_000,
          lineTotalMinor: 200_000,
          supplierCostSnapshotMinor: 60_000,
        },
      ],
    };
  }

  public async getPeriodAggregates(input: { period: string; currency: Currency }): Promise<PeriodAggregate> {
    return this.aggregate ?? {
      period: input.period,
      currency: input.currency,
      revenueMinor: 224_900,
      costMinor: 120_000,
      marginMinor: 104_900,
      ordersCount: 1,
      linesMissingCost: 0,
    };
  }
}

class FakeRenderer implements PdfRendererPort {
  public async render(): Promise<RenderedDocument> {
    return { bytes: Buffer.from("document"), contentHash: "content-hash" };
  }
}

class FakeStorage implements DocumentStoragePort {
  public async putDocument(input: { storageKey: string; bytes: Buffer }): Promise<{ storageKey: string; checksum: string }> {
    return { storageKey: input.storageKey, checksum: "checksum" };
  }

  public async getSignedDownloadUrl(): Promise<{ url: string; expiresAt: Date }> {
    return { url: "/signed", expiresAt: now };
  }
}

class FakeSequence implements NumberSequencePort {
  public async nextNumber(): Promise<number> {
    return 1;
  }
}

class FakeFinanceRepository implements FinanceRepository {
  public created: CreateAvailableDocumentRecord | null = null;

  public async findExistingGeneration(): Promise<null> {
    return null;
  }

  public async createAvailableDocument(input: CreateAvailableDocumentRecord): Promise<CreateAvailableDocumentResult> {
    this.created = input;
    return { type: "CREATED", document: documentEntity(input) };
  }

  public async getDocument(): Promise<FinanceDocumentEntity | null> {
    return documentEntity();
  }

  public async listDocuments(_input: ListDocumentsQuery): Promise<{ rows: FinanceDocumentEntity[]; nextCursor: string | null }> {
    return { rows: [documentEntity()], nextCursor: null };
  }

  public async recordDownload(): Promise<void> {}

  public async upsertPeriodSnapshot(input: Omit<FinancePeriodSnapshotEntity, "id" | "computedAt">): Promise<FinancePeriodSnapshotEntity> {
    return {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      computedAt: now,
      ...input,
    };
  }

  public async getPeriodSnapshot(): Promise<FinancePeriodSnapshotEntity | null> {
    return null;
  }
}

const documentEntity = (input?: Partial<CreateAvailableDocumentRecord>): FinanceDocumentEntity => ({
  id: documentId,
  type: input?.type ?? DocumentType.REMITO,
  series: input?.series ?? "A",
  number: input?.number ?? 1,
  displayNumber: input?.displayNumber ?? "R-0001",
  orderId: input?.orderId ?? orderId,
  customerId: input?.customerId ?? customerId,
  status: DocumentStatus.AVAILABLE,
  issuedAt: input?.issuedAt ?? now,
  totalMinor: input?.totalMinor ?? 224_900,
  currency: input?.currency ?? "ARS",
  pdfStorageKey: input?.pdfStorageKey ?? "documents/R-0001.ccdoc",
  pdfChecksum: input?.pdfChecksum ?? "checksum",
  contentHash: input?.contentHash ?? "content-hash",
  relatedDocumentId: null,
  createdBy: input?.createdBy ?? "admin-user",
  createdAt: now,
  updatedAt: now,
});
