import { DocumentType } from "@cloudcommerce/types";
import { z } from "zod";
import { UuidSchema } from "./common.js";

/** Período contable: 'YYYY-MM' (mes calendario, zona horaria del negocio). */
export const PeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El período debe tener el formato YYYY-MM");

export const GenerateDocumentSchema = z.object({
  type: z.nativeEnum(DocumentType),
  orderId: UuidSchema,
  series: z.string().trim().min(1).max(8).optional(),
});

export const RegenerateDocumentSchema = z.object({
  documentId: UuidSchema,
});

export const GetDocumentSchema = z.object({
  documentId: UuidSchema,
  reason: z.string().trim().min(3).max(300).optional(),
});

export const ListDocumentsSchema = z.object({
  orderId: UuidSchema.optional(),
  customerId: UuidSchema.optional(),
  type: z.nativeEnum(DocumentType).optional(),
  cursor: z.string().max(512).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const DownloadDocumentSchema = z.object({
  documentId: UuidSchema,
  // Requerido por rol (SUPPORT) mediante policy en la capa de aplicación.
  reason: z.string().trim().min(3).max(300).optional(),
});

export const FinancePeriodReportQuerySchema = z.object({
  period: PeriodSchema,
  compareTo: z.union([z.literal("previous"), PeriodSchema]).optional(),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
});

export const FinanceKpisQuerySchema = z.object({
  range: z.union([
    z.enum(["this-month", "last-30d", "ytd"]),
    z.object({ from: PeriodSchema, to: PeriodSchema }),
  ]),
  currency: z.enum(["ARS", "USD"]).default("ARS"),
});

export const RecomputePeriodSnapshotSchema = z.object({
  period: PeriodSchema,
  currency: z.enum(["ARS", "USD"]).default("ARS"),
});

export type GenerateDocumentInput = z.infer<typeof GenerateDocumentSchema>;
export type RegenerateDocumentInput = z.infer<typeof RegenerateDocumentSchema>;
export type GetDocumentInput = z.infer<typeof GetDocumentSchema>;
export type ListDocumentsInput = z.infer<typeof ListDocumentsSchema>;
export type DownloadDocumentInput = z.infer<typeof DownloadDocumentSchema>;
export type FinancePeriodReportQuery = z.infer<typeof FinancePeriodReportQuerySchema>;
export type FinanceKpisQuery = z.infer<typeof FinanceKpisQuerySchema>;
export type RecomputePeriodSnapshotInput = z.infer<typeof RecomputePeriodSnapshotSchema>;
