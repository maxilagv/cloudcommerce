import type { Currency } from "./domain.js";
import type { AiAlertKind, AiAlertStatus, AiGenerationKind, AiGenerationStatus, AiTargetType } from "./enums.js";

export type AiUsage = {
  costMinor: number;
  currency: Currency;
  unit: "tokens" | "image";
  amount: number;
};

export type AiText = {
  text: string;
  model: string;
  usage: AiUsage;
};

export type AiSeo = {
  title: string;
  metaDescription: string;
  keywords: string[];
  model: string;
  usage: AiUsage;
};

export type AiSpecItemDraft = {
  key: string;
  label: string;
  valueText: string | null;
  valueNum: number | null;
  unit: string | null;
};

export type AiSpecGroups = {
  groups: Array<{ name: string; items: AiSpecItemDraft[] }>;
  model: string;
  usage: AiUsage;
};

export type AiRecommendation = {
  productId: string;
  score: number;
  reasonCodes: string[];
  evidence: {
    matchedAttributes: string[];
    basedOn: string[];
  };
};

export type AiRecommendationResult = {
  recommendations: AiRecommendation[];
  degraded: boolean;
};

export type AiTrendSignal = {
  targetType: AiTargetType;
  targetId: string | null;
  signal: string;
  score: number;
  window: string;
};

export type AiPriceSuggestion = {
  variantId: string;
  suggestedAmountMinor: number;
  currency: Currency;
  marginPct: number;
  rationale: string;
  withinMinMargin: boolean;
};

export type AiGenerationSummary = {
  id: string;
  kind: AiGenerationKind;
  targetType: AiTargetType;
  targetId: string | null;
  status: AiGenerationStatus;
  costEstimateMinor: number | null;
  currency: Currency;
  actorId: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AiGenerationListResult = {
  items: AiGenerationSummary[];
  nextCursor: string | null;
};

export type AiUsageSummary = {
  period: { from: string; to: string };
  totalCostMinor: number;
  currency: Currency;
  count: number;
  byKind: Array<{ kind: AiGenerationKind; count: number; costMinor: number }>;
  byStatus: Array<{ status: AiGenerationStatus; count: number }>;
};

export type AiAlertRecord = {
  id: string;
  kind: AiAlertKind;
  payload: Record<string, unknown>;
  status: AiAlertStatus;
  createdAt: string;
  resolvedAt: string | null;
};

export type AiAlertListResult = {
  items: AiAlertRecord[];
  nextCursor: string | null;
};
