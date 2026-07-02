import type { SupplierFeedKind, SupplierFeedStatus, SupplierForwardStatus, SupplierSyncStatus } from "./enums.js";

export type SupplierContact = {
  email?: string | undefined;
  phone?: string | undefined;
  person?: string | undefined;
};

export type SupplierSummary = {
  id: string;
  name: string;
  slug: string;
  contact: SupplierContact | null;
  isActive: boolean;
  hasApiConfig: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SupplierListResult = {
  items: SupplierSummary[];
  nextCursor: string | null;
};

export type SupplierFeedRunSummary = {
  read: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  discontinued: number;
  errors: number;
};

export type SupplierFeedRecord = {
  id: string;
  supplierId: string;
  kind: SupplierFeedKind;
  sourceUrl: string | null;
  schedule: string | null;
  fieldMap: Record<string, string> | null;
  status: SupplierFeedStatus;
  lastRunAt: string | null;
  lastRunSummary: SupplierFeedRunSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type SupplierProductMapRecord = {
  id: string;
  supplierId: string;
  externalId: string;
  variantId: string | null;
  syncStatus: SupplierSyncStatus;
  lastSeenAt: string | null;
  syncedAt: string | null;
  createdAt: string;
};

export type SupplierProductMapListResult = {
  items: SupplierProductMapRecord[];
  nextCursor: string | null;
};

export type SupplierOrderRefRecord = {
  id: string;
  orderId: string;
  supplierId: string;
  externalOrderId: string | null;
  status: SupplierForwardStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedRunResult = {
  feedId: string;
  status: SupplierFeedStatus;
  dryRun: boolean;
  summary: SupplierFeedRunSummary;
};
