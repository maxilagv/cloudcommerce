import type { Currency, DocumentType, OrderStatus } from "@cloudcommerce/types";

export type OrderDocumentLineSource = {
  variantId: string;
  productTitle: string;
  sku: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  supplierCostSnapshotMinor: number | null;
};

export type OrderDocumentSource = {
  id: string;
  orderNumber: string;
  customerId: string;
  status: OrderStatus;
  currency: Currency;
  totalMinor: number;
  confirmedAt: Date | null;
  createdAt: Date;
  lines: OrderDocumentLineSource[];
};

export type PeriodAggregate = {
  period: string;
  currency: Currency;
  revenueMinor: number;
  costMinor: number;
  marginMinor: number;
  ordersCount: number;
  linesMissingCost: number;
};

export interface OrdersReadModelPort {
  getOrderForDocument(orderId: string): Promise<OrderDocumentSource | null>;
  getPeriodAggregates(input: { period: string; currency: Currency }): Promise<PeriodAggregate>;
}

export type RenderedDocument = {
  bytes: Buffer;
  contentHash: string;
};

export interface PdfRendererPort {
  render(input: {
    type: DocumentType;
    series: string;
    order: OrderDocumentSource;
    displayNumber: string;
    issuedAt: Date;
  }): Promise<RenderedDocument>;
}

export interface DocumentStoragePort {
  putDocument(input: { storageKey: string; bytes: Buffer }): Promise<{ storageKey: string; checksum: string }>;
  getSignedDownloadUrl(input: { storageKey: string; filename: string; ttlSeconds: number }): Promise<{ url: string; expiresAt: Date }>;
}

export interface NumberSequencePort {
  nextNumber(input: { type: DocumentType; series: string }): Promise<number>;
}
