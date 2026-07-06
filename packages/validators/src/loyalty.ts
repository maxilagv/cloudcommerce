import { CloudDigitalStatus, LoyaltyRedemptionStatus, LoyaltyRewardKind } from "@cloudcommerce/types";
import { z } from "zod";
import { ReasonSchema, UuidSchema } from "./common.js";

// ---------------------------------------------------------------------------
// Cliente (storefront)
// ---------------------------------------------------------------------------

export const LoyaltyTransactionsQuerySchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();
export type LoyaltyTransactionsQueryInput = z.infer<typeof LoyaltyTransactionsQuerySchema>;

export const RedeemRewardSchema = z
  .object({
    rewardId: UuidSchema,
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .strict();
export type RedeemRewardInput = z.infer<typeof RedeemRewardSchema>;

// ---------------------------------------------------------------------------
// Admin — recompensas y canjes
// ---------------------------------------------------------------------------

export const UpsertLoyaltyRewardSchema = z
  .object({
    id: UuidSchema.optional(),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(600).default(""),
    kind: z.nativeEnum(LoyaltyRewardKind),
    pointsCost: z.number().int().min(1).max(1_000_000),
    stock: z.number().int().min(0).nullable().default(null),
    imageId: UuidSchema.nullable().default(null),
    availableFrom: z.coerce.date().nullable().default(null),
    availableUntil: z.coerce.date().nullable().default(null),
    isActive: z.boolean().default(true),
    position: z.number().int().min(0).max(999).default(0),
  })
  .strict()
  .refine(
    (value) =>
      !value.availableFrom || !value.availableUntil || value.availableFrom < value.availableUntil,
    "availableFrom debe ser anterior a availableUntil",
  );
export type UpsertLoyaltyRewardInput = z.infer<typeof UpsertLoyaltyRewardSchema>;

export const ListLoyaltyRedemptionsSchema = z
  .object({
    status: z.nativeEnum(LoyaltyRedemptionStatus).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict();
export type ListLoyaltyRedemptionsInput = z.infer<typeof ListLoyaltyRedemptionsSchema>;

export const ResolveRedemptionSchema = z
  .object({
    redemptionId: UuidSchema,
    action: z.enum(["FULFILL", "CANCEL"]),
    note: z.string().trim().max(300).optional(),
  })
  .strict();
export type ResolveRedemptionInput = z.infer<typeof ResolveRedemptionSchema>;

export const AdjustLoyaltyPointsSchema = z
  .object({
    customerId: UuidSchema,
    points: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((value) => value !== 0, "El ajuste no puede ser 0"),
    reason: ReasonSchema,
  })
  .strict();
export type AdjustLoyaltyPointsInput = z.infer<typeof AdjustLoyaltyPointsSchema>;

export const UpdateLoyaltyConfigSchema = z
  .object({
    pointsPer1000: z.number().int().min(0).max(10_000),
    isEnabled: z.boolean(),
  })
  .strict();
export type UpdateLoyaltyConfigInput = z.infer<typeof UpdateLoyaltyConfigSchema>;

// ---------------------------------------------------------------------------
// CloudDigital
// ---------------------------------------------------------------------------

export const UpsertCloudDigitalBenefitSchema = z
  .object({
    id: UuidSchema.optional(),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(600).default(""),
    partner: z.string().trim().min(2).max(80).default("LayerCloud"),
    discountLabel: z.string().trim().min(1).max(40),
    code: z.string().trim().min(2).max(80).nullable().default(null),
    url: z.string().trim().url().max(300).nullable().default(null),
    isActive: z.boolean().default(true),
    position: z.number().int().min(0).max(999).default(0),
  })
  .strict();
export type UpsertCloudDigitalBenefitInput = z.infer<typeof UpsertCloudDigitalBenefitSchema>;

export const ListCloudDigitalMembershipsSchema = z
  .object({
    status: z.nativeEnum(CloudDigitalStatus).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .strict();
export type ListCloudDigitalMembershipsInput = z.infer<typeof ListCloudDigitalMembershipsSchema>;

export const SetCloudDigitalMembershipStatusSchema = z
  .object({
    customerId: UuidSchema,
    status: z.nativeEnum(CloudDigitalStatus),
  })
  .strict();
export type SetCloudDigitalMembershipStatusInput = z.infer<
  typeof SetCloudDigitalMembershipStatusSchema
>;
