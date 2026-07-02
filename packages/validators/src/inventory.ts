import { z } from "zod";
import { ReasonSchema, UuidSchema } from "./common.js";

const QuantitySchema = z.number().int().positive().max(1_000_000);

export const VariantInventoryInputSchema = z.object({
  variantId: UuidSchema,
});

export const AdjustStockInputSchema = z.object({
  variantId: UuidSchema,
  delta: z.number().int().min(-1_000_000).max(1_000_000).refine((value) => value !== 0, "delta cannot be zero"),
  reason: ReasonSchema,
  refType: z.string().trim().min(2).max(80).optional().nullable(),
  refId: z.string().trim().min(1).max(160).optional().nullable(),
});

export const ImportStockInputSchema = z.object({
  variantId: UuidSchema,
  quantity: QuantitySchema,
  reason: ReasonSchema.default("Manual stock import"),
  refType: z.string().trim().min(2).max(80).default("manual_import"),
  refId: z.string().trim().min(1).max(160).optional().nullable(),
  reorderPoint: z.number().int().min(0).max(1_000_000).optional().nullable(),
});

export const ReserveStockItemInputSchema = z.object({
  variantId: UuidSchema,
  quantity: QuantitySchema,
});

export const ReserveStockInputSchema = z.object({
  items: z.array(ReserveStockItemInputSchema).min(1).max(50),
  ttlSeconds: z.number().int().min(60).max(7_200).default(900),
  orderId: UuidSchema.optional().nullable(),
  reason: ReasonSchema.default("Stock reservation"),
});

export const ReservationIdInputSchema = z.object({
  reservationId: UuidSchema,
});

export const ConfirmReservationInputSchema = ReservationIdInputSchema.extend({
  orderId: UuidSchema.optional().nullable(),
  reason: ReasonSchema.default("Reservation confirmed"),
});

export const ReleaseReservationInputSchema = ReservationIdInputSchema.extend({
  reason: ReasonSchema.default("Reservation released"),
});

export const ListStockMovementsInputSchema = z.object({
  variantId: UuidSchema.optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const ListStockReservationsInputSchema = z.object({
  variantId: UuidSchema.optional(),
  activeOnly: z.boolean().default(false),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export const ExpireReservationsInputSchema = z.object({
  batchSize: z.number().int().min(1).max(500).default(100),
  now: z.coerce.date().default(() => new Date()),
});

export type VariantInventoryInput = z.infer<typeof VariantInventoryInputSchema>;
export type AdjustStockInput = z.infer<typeof AdjustStockInputSchema>;
export type ImportStockInput = z.infer<typeof ImportStockInputSchema>;
export type ReserveStockInput = z.infer<typeof ReserveStockInputSchema>;
export type ConfirmReservationInput = z.infer<typeof ConfirmReservationInputSchema>;
export type ReleaseReservationInput = z.infer<typeof ReleaseReservationInputSchema>;
export type ListStockMovementsInput = z.infer<typeof ListStockMovementsInputSchema>;
export type ListStockReservationsInput = z.infer<typeof ListStockReservationsInputSchema>;
export type ExpireReservationsInput = z.infer<typeof ExpireReservationsInputSchema>;
