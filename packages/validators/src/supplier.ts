import { SupplierFeedKind, SupplierForwardStatus, SupplierSyncStatus } from "@cloudcommerce/types";
import { z } from "zod";
import { UuidSchema } from "./common.js";

const CursorSchema = z.string().trim().min(1).max(512).optional();
const SlugSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const CronSchema = z.string().trim().regex(/^(\S+\s+){4}\S+$/, "Cron invalido: se esperan 5 campos.");

export const SupplierContactSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  person: z.string().trim().min(1).max(120).optional(),
}).strict();

export const SupplierApiConfigSchema = z.object({
  baseUrl: z.string().trim().url(),
  authKind: z.enum(["api_key", "bearer", "hmac"]),
  apiKey: z.string().trim().min(8).max(512).optional(),
  webhookSecret: z.string().trim().min(16).max(512).optional(),
}).strict();
export type SupplierApiConfigInput = z.infer<typeof SupplierApiConfigSchema>;

export const CreateSupplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: SlugSchema.optional(),
  contact: SupplierContactSchema.optional(),
  apiConfig: SupplierApiConfigSchema.optional(),
}).strict();
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;

export const UpdateSupplierSchema = z.object({
  supplierId: UuidSchema,
  name: z.string().trim().min(1).max(160).optional(),
  contact: SupplierContactSchema.nullable().optional(),
}).strict();
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;

export const SetSupplierActiveSchema = z.object({
  supplierId: UuidSchema,
  isActive: z.boolean(),
}).strict();
export type SetSupplierActiveInput = z.infer<typeof SetSupplierActiveSchema>;

export const SetSupplierApiConfigSchema = z.object({
  supplierId: UuidSchema,
  apiConfig: SupplierApiConfigSchema,
}).strict();
export type SetSupplierApiConfigInput = z.infer<typeof SetSupplierApiConfigSchema>;

export const ListSuppliersSchema = z.object({
  cursor: CursorSchema,
  limit: z.number().int().min(1).max(50).default(24),
  isActive: z.boolean().optional(),
}).strict();
export type ListSuppliersInput = z.infer<typeof ListSuppliersSchema>;

export const GetSupplierSchema = z.object({
  supplierId: UuidSchema,
}).strict();
export type GetSupplierInput = z.infer<typeof GetSupplierSchema>;

export const FeedFieldMapSchema = z.object({
  externalId: z.string().trim().min(1).max(80).default("external_id"),
  title: z.string().trim().min(1).max(80).default("title"),
  costAmountMinor: z.string().trim().min(1).max(80).default("cost_amount_minor"),
  stock: z.string().trim().min(1).max(80).default("stock"),
  discontinued: z.string().trim().min(1).max(80).default("discontinued"),
}).strict();
export type FeedFieldMapInput = z.infer<typeof FeedFieldMapSchema>;

export const ConfigureFeedSchema = z.object({
  supplierId: UuidSchema,
  kind: z.nativeEnum(SupplierFeedKind),
  sourceUrl: z.string().trim().url().optional(),
  schedule: CronSchema.optional(),
  fieldMap: FeedFieldMapSchema.optional(),
}).strict();
export type ConfigureFeedInput = z.infer<typeof ConfigureFeedSchema>;

export const ListFeedsSchema = z.object({
  supplierId: UuidSchema,
}).strict();
export type ListFeedsInput = z.infer<typeof ListFeedsSchema>;

export const RunFeedSchema = z.object({
  feedId: UuidSchema,
  dryRun: z.boolean().default(false),
}).strict();
export type RunFeedInput = z.infer<typeof RunFeedSchema>;

export const ListSupplierMapSchema = z.object({
  supplierId: UuidSchema,
  status: z.nativeEnum(SupplierSyncStatus).optional(),
  cursor: CursorSchema,
  limit: z.number().int().min(1).max(50).default(24),
}).strict();
export type ListSupplierMapInput = z.infer<typeof ListSupplierMapSchema>;

export const LinkSupplierProductSchema = z.object({
  mapId: UuidSchema,
  variantId: UuidSchema,
}).strict();
export type LinkSupplierProductInput = z.infer<typeof LinkSupplierProductSchema>;

export const ListOrderRefsSchema = z.object({
  orderId: UuidSchema,
}).strict();
export type ListOrderRefsInput = z.infer<typeof ListOrderRefsSchema>;

export const RetryForwardSchema = z.object({
  orderId: UuidSchema,
  supplierId: UuidSchema,
}).strict();
export type RetryForwardInput = z.infer<typeof RetryForwardSchema>;

/**
 * Capa anticorrupción: una fila cruda del feed del proveedor. Nada del tercero
 * entra al dominio sin pasar por acá. El costo SIEMPRE entra como entero menor.
 */
export const SupplierFeedRowSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(300).optional(),
  costAmountMinor: z.number().int().min(0).optional(),
  currency: z.literal("ARS").default("ARS"),
  stock: z.number().int().min(0).optional(),
  discontinued: z.boolean().default(false),
});
export type SupplierFeedRow = z.infer<typeof SupplierFeedRowSchema>;

/** Respuesta del proveedor al reenvío de un pedido — validada antes de confiar. */
export const SupplierForwardResponseSchema = z.object({
  accepted: z.boolean(),
  externalOrderId: z.string().trim().min(1).max(160).optional(),
  reason: z.string().trim().max(500).optional(),
});
export type SupplierForwardResponse = z.infer<typeof SupplierForwardResponseSchema>;

/** Payload del webhook de fulfillment del proveedor. */
export const SupplierWebhookPayloadSchema = z.object({
  eventId: z.string().trim().min(8).max(160),
  externalOrderId: z.string().trim().min(1).max(160),
  status: z.enum(["PREPARED", "DISPATCHED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "DELAYED", "FAILED_ATTEMPT"]),
  carrier: z.string().trim().max(120).optional(),
  trackingCode: z.string().trim().max(160).optional(),
  description: z.string().trim().max(500).optional(),
  occurredAt: z.string().datetime(),
});
export type SupplierWebhookPayload = z.infer<typeof SupplierWebhookPayloadSchema>;

export const SupplierForwardStatusSchema = z.nativeEnum(SupplierForwardStatus);
