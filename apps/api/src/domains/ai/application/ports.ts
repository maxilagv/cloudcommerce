import type {
  AiAlertKind,
  AiAlertRecord,
  AiAlertStatus,
  AiGenerationKind,
  AiGenerationStatus,
  AiGenerationSummary,
  AiPriceSuggestion,
  AiRecommendation,
  AiSeo,
  AiSpecGroups,
  AiTargetType,
  AiText,
  AiTrendSignal,
  AiUsage,
} from "@cloudcommerce/types";
import type { Result } from "../../../shared/domain/result.js";

/**
 * Contexto que viaja al servicio IA. Se construye SIEMPRE por whitelist:
 * nunca incluye PII, credenciales ni costo proveedor salvo el caso condicional
 * de pricing (actor con permiso de costo).
 */
export type AiProductContext = {
  productId: string;
  title: string;
  subtitle: string | null;
  description: string;
  categoryName: string;
  brandName: string | null;
  specs: Array<{ key: string; label: string; valueText: string | null; valueNum: number | null; unit: string | null }>;
  variantAttributes: Array<Record<string, string | number | boolean | null>>;
};

export type AiCategoryContext = {
  categoryId: string;
  name: string;
  description: string | null;
};

export type AiPricingContext = {
  variantId: string;
  productTitle: string;
  categoryName: string;
  currentPriceMinor: number | null;
  supplierCostMinor: number;
  currency: "ARS";
  minMarginBps: number | null;
};

export type AiCatalogCandidate = {
  productId: string;
  title: string;
  categoryId: string;
  categoryName: string;
  brandName: string | null;
  attributes: Record<string, string | number | boolean | null>;
};

export type AiUpstreamError =
  | { type: "UPSTREAM_UNAVAILABLE" }
  | { type: "RESPONSE_INVALID" };

export interface AiGatewayPort {
  generateProductDescription(input: {
    generationId: string;
    requestId: string;
    locale: string;
    tone: string | null;
    maxChars: number;
    product: AiProductContext;
  }): Promise<Result<AiText, AiUpstreamError>>;

  generateProductSpecs(input: {
    generationId: string;
    requestId: string;
    sourceHints: string | null;
    product: AiProductContext;
  }): Promise<Result<AiSpecGroups, AiUpstreamError>>;

  generateSeo(input: {
    generationId: string;
    requestId: string;
    product: AiProductContext | null;
    category: AiCategoryContext | null;
  }): Promise<Result<AiSeo, AiUpstreamError>>;

  getRecommendations(input: {
    generationId: string;
    requestId: string;
    seed: AiCatalogCandidate | null;
    candidates: AiCatalogCandidate[];
    limit: number;
  }): Promise<Result<{ recommendations: AiRecommendation[]; usage: AiUsage }, AiUpstreamError>>;

  analyzeTrends(input: {
    generationId: string;
    requestId: string;
    scope: "category" | "supplierFeed" | "store";
    scopeId: string | null;
    window: string;
    candidates: AiCatalogCandidate[];
  }): Promise<Result<{ signals: AiTrendSignal[]; usage: AiUsage }, AiUpstreamError>>;

  optimizePricing(input: {
    generationId: string;
    requestId: string;
    contexts: AiPricingContext[];
  }): Promise<Result<{ suggestions: AiPriceSuggestion[]; usage: AiUsage }, AiUpstreamError>>;
}

export type CreateGenerationRecord = {
  id: string;
  kind: AiGenerationKind;
  targetType: AiTargetType;
  targetId: string | null;
  promptRef: string;
  costEstimateMinor: number;
  actorId: string | null;
};

export type CompleteGenerationRecord = {
  id: string;
  status: AiGenerationStatus;
  costEstimateMinor?: number;
  errorCode?: string | null;
};

export type ListGenerationsFilters = {
  cursor?: string | undefined;
  limit: number;
  kind?: AiGenerationKind | undefined;
  status?: AiGenerationStatus | undefined;
  targetId?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

export type ListAlertsFilters = {
  cursor?: string | undefined;
  limit: number;
  kind?: AiAlertKind | undefined;
  status?: AiAlertStatus | undefined;
};

export type UpsertAlertRecord = {
  id: string;
  kind: AiAlertKind;
  payload: Record<string, unknown>;
  dedupeKey: string | null;
};

export interface AiRepository {
  createGeneration(record: CreateGenerationRecord): Promise<void>;
  completeGeneration(record: CompleteGenerationRecord): Promise<void>;
  findGenerationById(id: string): Promise<AiGenerationSummary | null>;
  findGenerationByPromptRef(promptRef: string, withinMinutes: number): Promise<AiGenerationSummary | null>;
  listGenerations(filters: ListGenerationsFilters): Promise<{ items: AiGenerationSummary[]; nextCursor: string | null }>;
  sumCostSince(actorId: string | null, since: Date): Promise<number>;
  usageSummary(from: Date, to: Date): Promise<{
    totalCostMinor: number;
    count: number;
    byKind: Array<{ kind: AiGenerationKind; count: number; costMinor: number }>;
    byStatus: Array<{ status: AiGenerationStatus; count: number }>;
  }>;

  upsertOpenAlert(record: UpsertAlertRecord): Promise<AiAlertRecord>;
  findAlertById(id: string): Promise<AiAlertRecord | null>;
  listAlerts(filters: ListAlertsFilters): Promise<{ items: AiAlertRecord[]; nextCursor: string | null }>;
  setAlertStatus(input: {
    alertId: string;
    status: AiAlertStatus;
    resolvedBy: string | null;
    note: string | null;
  }): Promise<AiAlertRecord | null>;
}

export interface AiRateLimiterPort {
  /** Devuelve segundos de espera si el actor excedió la ventana; null si puede continuar. */
  check(actorKey: string, kind: AiGenerationKind): Promise<number | null>;
}

export interface AiContextReaderPort {
  getProductContext(productId: string): Promise<AiProductContext | null>;
  getCategoryContext(categoryId: string): Promise<AiCategoryContext | null>;
  listPublishedCandidates(input: { categoryId?: string | undefined; excludeProductId?: string | undefined; limit: number }): Promise<AiCatalogCandidate[]>;
  getPricingContexts(input: { variantId?: string | undefined; categoryId?: string | undefined; limit: number }): Promise<AiPricingContext[]>;
  getFallbackRecommendations(input: { seedProductId?: string | undefined; categoryId?: string | undefined; limit: number }): Promise<AiRecommendation[]>;
}
