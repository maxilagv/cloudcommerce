import type { Currency, DocumentStatus, DocumentType } from "@cloudcommerce/types";

export type RequestAuditContext = {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  reason?: string | null;
};

export type FinanceDocumentEntity = {
  id: string;
  type: DocumentType;
  series: string;
  number: number;
  displayNumber: string;
  orderId: string | null;
  customerId: string | null;
  status: DocumentStatus;
  issuedAt: Date | null;
  totalMinor: number;
  currency: Currency;
  pdfStorageKey: string | null;
  pdfChecksum: string | null;
  contentHash: string;
  relatedDocumentId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FinancePeriodSnapshotEntity = {
  id: string;
  period: string;
  currency: Currency;
  revenueMinor: number;
  costMinor: number;
  marginMinor: number;
  ordersCount: number;
  computedAt: Date;
  sourceVersion: string;
  isStale: boolean;
};

export type CreateAvailableDocumentRecord = {
  idempotencyKey: string | null;
  requestHash: string;
  type: DocumentType;
  series: string;
  number: number;
  displayNumber: string;
  orderId: string;
  customerId: string;
  totalMinor: number;
  currency: Currency;
  contentHash: string;
  pdfStorageKey: string;
  pdfChecksum: string;
  relatedDocumentId: string | null;
  createdBy: string;
  issuedAt: Date;
};

export type CreateAvailableDocumentResult =
  | { type: "CREATED"; document: FinanceDocumentEntity }
  | { type: "REUSED"; document: FinanceDocumentEntity }
  | { type: "IDEMPOTENCY_CONFLICT" }
  | { type: "DOCUMENT_ALREADY_ISSUED" };

export type ExistingDocumentGenerationResult =
  | { type: "REUSED"; document: FinanceDocumentEntity }
  | { type: "IDEMPOTENCY_CONFLICT" }
  | { type: "DOCUMENT_ALREADY_ISSUED" };

export type ListDocumentsQuery = {
  orderId?: string;
  customerId?: string;
  type?: DocumentType;
  cursor?: string;
  limit: number;
};

export interface FinanceRepository {
  findExistingGeneration(input: {
    idempotencyKey: string | null;
    requestHash: string;
    actorId: string;
    type: DocumentType;
    orderId: string;
  }): Promise<ExistingDocumentGenerationResult | null>;
  createAvailableDocument(input: CreateAvailableDocumentRecord, audit: RequestAuditContext): Promise<CreateAvailableDocumentResult>;
  replaceDocumentFile(input: {
    documentId: string;
    pdfStorageKey: string;
    pdfChecksum: string;
    contentHash: string;
  }): Promise<FinanceDocumentEntity | null>;
  getDocument(documentId: string): Promise<FinanceDocumentEntity | null>;
  listDocuments(input: ListDocumentsQuery): Promise<{ rows: FinanceDocumentEntity[]; nextCursor: string | null }>;
  recordDownload(input: { documentId: string; actorId: string | null; reason: string | null; ip: string | null; userAgent: string | null }): Promise<void>;
  upsertPeriodSnapshot(input: Omit<FinancePeriodSnapshotEntity, "id" | "computedAt">): Promise<FinancePeriodSnapshotEntity>;
  getPeriodSnapshot(period: string, currency: Currency): Promise<FinancePeriodSnapshotEntity | null>;
}
