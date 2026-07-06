import { AiAlertKind, AiAlertStatus, AiGenerationKind, AiGenerationStatus } from "@cloudcommerce/types";
import { z } from "zod";
import { ReasonSchema, UuidSchema } from "./common.js";

const CursorSchema = z.string().trim().min(1).max(512).optional();
const IdempotencyKeySchema = z.string().trim().min(8).max(128).optional();

export const GenerateDescriptionSchema = z.object({
  productId: UuidSchema,
  locale: z.string().trim().min(2).max(10).default("es-AR"),
  tone: z.string().trim().min(3).max(120).optional(),
  maxChars: z.number().int().min(200).max(5_000).default(1_200),
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionSchema>;

export const GenerateSpecsSchema = z.object({
  productId: UuidSchema,
  sourceHints: z.string().trim().max(4_000).optional(),
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type GenerateSpecsInput = z.infer<typeof GenerateSpecsSchema>;

export const GenerateSeoSchema = z.object({
  productId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  idempotencyKey: IdempotencyKeySchema,
}).strict().refine((input) => Boolean(input.productId) !== Boolean(input.categoryId), {
  message: "Debe indicarse productId o categoryId, no ambos.",
});
export type GenerateSeoInput = z.infer<typeof GenerateSeoSchema>;

export const AiImageStyleSchema = z.enum(["studio", "lifestyle", "hero", "minimal"]);
export type AiImageStyle = z.infer<typeof AiImageStyleSchema>;

export const AnalyzeImageSchema = z.object({
  productId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  /** Imagen a analizar; si se omite se usa la imagen principal del target. */
  sourceMediaAssetId: UuidSchema.optional(),
  idempotencyKey: IdempotencyKeySchema,
}).strict().refine((input) => Boolean(input.productId) !== Boolean(input.categoryId), {
  message: "Debe indicarse productId o categoryId, no ambos.",
});
export type AnalyzeImageInput = z.infer<typeof AnalyzeImageSchema>;

export const GenerateImageSchema = z.object({
  productId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  /** enhance = mejora una foto existente; generate = crea desde cero (con o sin referencia). */
  mode: z.enum(["enhance", "generate"]).default("enhance"),
  /** Fuente para enhance / referencia para generate; default: imagen principal del target. */
  sourceMediaAssetId: UuidSchema.optional(),
  style: AiImageStyleSchema.default("studio"),
  instructions: z.string().trim().max(500).optional(),
  /** Si true, la imagen resultante se aplica como imagen principal del producto/categoría. */
  applyToTarget: z.boolean().default(false),
  idempotencyKey: IdempotencyKeySchema,
}).strict().refine((input) => Boolean(input.productId) !== Boolean(input.categoryId), {
  message: "Debe indicarse productId o categoryId, no ambos.",
});
export type GenerateImageInput = z.infer<typeof GenerateImageSchema>;

export const GetRecommendationsSchema = z.object({
  seedProductId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  limit: z.number().int().min(1).max(12).default(6),
}).strict();
export type GetRecommendationsInput = z.infer<typeof GetRecommendationsSchema>;

export const AnalyzeTrendsSchema = z.object({
  scope: z.enum(["category", "supplierFeed", "store"]),
  scopeId: UuidSchema.optional(),
  window: z.enum(["7d", "30d", "90d"]).default("30d"),
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type AnalyzeTrendsInput = z.infer<typeof AnalyzeTrendsSchema>;

export const OptimizePricingSchema = z.object({
  variantId: UuidSchema.optional(),
  categoryId: UuidSchema.optional(),
  idempotencyKey: IdempotencyKeySchema,
}).strict().refine((input) => Boolean(input.variantId) !== Boolean(input.categoryId), {
  message: "Debe indicarse variantId o categoryId, no ambos.",
});
export type OptimizePricingInput = z.infer<typeof OptimizePricingSchema>;

export const ListGenerationsSchema = z.object({
  cursor: CursorSchema,
  limit: z.number().int().min(1).max(50).default(20),
  kind: z.nativeEnum(AiGenerationKind).optional(),
  status: z.nativeEnum(AiGenerationStatus).optional(),
  targetId: UuidSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).strict();
export type ListGenerationsInput = z.infer<typeof ListGenerationsSchema>;

export const GetGenerationSchema = z.object({
  generationId: UuidSchema,
}).strict();
export type GetGenerationInput = z.infer<typeof GetGenerationSchema>;

export const GetUsageSummarySchema = z.object({
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
}).strict();
export type GetUsageSummaryInput = z.infer<typeof GetUsageSummarySchema>;

export const ListAiAlertsSchema = z.object({
  cursor: CursorSchema,
  limit: z.number().int().min(1).max(50).default(20),
  kind: z.nativeEnum(AiAlertKind).optional(),
  status: z.nativeEnum(AiAlertStatus).optional(),
}).strict();
export type ListAiAlertsInput = z.infer<typeof ListAiAlertsSchema>;

export const AcknowledgeAiAlertSchema = z.object({
  alertId: UuidSchema,
}).strict();
export type AcknowledgeAiAlertInput = z.infer<typeof AcknowledgeAiAlertSchema>;

export const ResolveAiAlertSchema = z.object({
  alertId: UuidSchema,
  note: z.string().trim().max(500).optional(),
}).strict();
export type ResolveAiAlertInput = z.infer<typeof ResolveAiAlertSchema>;

export const DismissAiAlertSchema = z.object({
  alertId: UuidSchema,
  reason: ReasonSchema,
}).strict();
export type DismissAiAlertInput = z.infer<typeof DismissAiAlertSchema>;
