import { PricingScope, PricingValueKind } from "@cloudcommerce/types";
import { z } from "zod";
import { UuidSchema } from "./common.js";

export const CurrencySchema = z.enum(["ARS", "USD"]);

export const MoneyAmountMinorSchema = z.number().int().min(0).max(999_999_999_999);
export const BasisPointsSchema = z.number().int().min(0).max(100_000);
export const MarginBasisPointsSchema = z.number().int().min(0).max(9_500);

export const PriceListIdInputSchema = z.object({
  priceListId: UuidSchema,
});

export const UpsertPriceListInputSchema = z.object({
  id: UuidSchema.optional(),
  name: z.string().trim().min(2).max(120),
  currency: CurrencySchema.default("ARS"),
  isDefault: z.boolean().default(false),
});

export const VariantPricingInputSchema = z.object({
  variantId: UuidSchema,
  currency: CurrencySchema.default("ARS"),
  /** Cantidad a cotizar — activa el tramo mayorista si corresponde. */
  quantity: z.number().int().min(1).max(9_999).optional(),
});

export const UpdateResaleConfigSchema = z
  .object({
    wholesaleEnabled: z.boolean(),
    wholesaleMinQty: z.number().int().min(2).max(999),
    wholesaleMarginBps: z.number().int().min(0).max(100_000),
    allowBackorder: z.boolean(),
  })
  .strict();
export type UpdateResaleConfigInput = z.infer<typeof UpdateResaleConfigSchema>;

export const SupplierRebateReportSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .strict()
  .refine((value) => value.from < value.to, "from debe ser anterior a to");
export type SupplierRebateReportInput = z.infer<typeof SupplierRebateReportSchema>;

export const SetSupplierRebateSchema = z
  .object({
    supplierId: UuidSchema,
    rebateBps: z.number().int().min(0).max(10_000),
  })
  .strict();
export type SetSupplierRebateInput = z.infer<typeof SetSupplierRebateSchema>;

export const SetSupplierCostInputSchema = z.object({
  variantId: UuidSchema,
  supplierId: UuidSchema.optional().nullable(),
  costAmountMinor: MoneyAmountMinorSchema,
  currency: CurrencySchema.default("ARS"),
  validFrom: z.coerce.date().default(() => new Date()),
});

export const SetMarkupRuleInputSchema = z.object({
  scope: z.nativeEnum(PricingScope),
  scopeId: UuidSchema.optional().nullable(),
  kind: z.nativeEnum(PricingValueKind),
  value: MoneyAmountMinorSchema,
  minMarginBps: MarginBasisPointsSchema.optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.scope === PricingScope.GLOBAL && value.scopeId) {
    ctx.addIssue({ code: "custom", path: ["scopeId"], message: "Global markup rules cannot include scopeId" });
  }
  if (value.scope !== PricingScope.GLOBAL && !value.scopeId) {
    ctx.addIssue({ code: "custom", path: ["scopeId"], message: "Scoped markup rules require scopeId" });
  }
  if (value.kind === PricingValueKind.PERCENT && value.value > 100_000) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "Percent values are basis points" });
  }
});

export const SetManualPriceInputSchema = z.object({
  variantId: UuidSchema,
  amountMinor: MoneyAmountMinorSchema,
  currency: CurrencySchema.default("ARS"),
  compareAtAmountMinor: MoneyAmountMinorSchema.optional().nullable(),
  validFrom: z.coerce.date().default(() => new Date()),
  validTo: z.coerce.date().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.validTo && value.validTo <= value.validFrom) {
    ctx.addIssue({ code: "custom", path: ["validTo"], message: "validTo must be after validFrom" });
  }
  if (value.compareAtAmountMinor !== null && value.compareAtAmountMinor !== undefined && value.compareAtAmountMinor <= value.amountMinor) {
    ctx.addIssue({ code: "custom", path: ["compareAtAmountMinor"], message: "compareAt must be greater than sale price" });
  }
});

export const DiscountInputSchema = z.object({
  code: z.string().trim().toUpperCase().min(3).max(80).optional().nullable(),
  scope: z.nativeEnum(PricingScope),
  scopeId: UuidSchema.optional().nullable(),
  kind: z.nativeEnum(PricingValueKind),
  value: MoneyAmountMinorSchema,
  validFrom: z.coerce.date().default(() => new Date()),
  validTo: z.coerce.date().optional().nullable(),
  maxUses: z.number().int().positive().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.scope === PricingScope.GLOBAL && value.scopeId) {
    ctx.addIssue({ code: "custom", path: ["scopeId"], message: "Global discounts cannot include scopeId" });
  }
  if (value.scope !== PricingScope.GLOBAL && !value.scopeId) {
    ctx.addIssue({ code: "custom", path: ["scopeId"], message: "Scoped discounts require scopeId" });
  }
  if (value.validTo && value.validTo <= value.validFrom) {
    ctx.addIssue({ code: "custom", path: ["validTo"], message: "validTo must be after validFrom" });
  }
});

export const CreateDiscountInputSchema = DiscountInputSchema;

export const DeactivateDiscountInputSchema = z.object({
  id: UuidSchema,
});

export const ListDiscountsInputSchema = z.object({
  includeInactive: z.boolean().default(false),
  code: z.string().trim().toUpperCase().min(3).max(80).optional(),
});

export type UpsertPriceListInput = z.infer<typeof UpsertPriceListInputSchema>;
export type VariantPricingInput = z.infer<typeof VariantPricingInputSchema>;
export type SetSupplierCostInput = z.infer<typeof SetSupplierCostInputSchema>;
export type SetMarkupRuleInput = z.infer<typeof SetMarkupRuleInputSchema>;
export type SetManualPriceInput = z.infer<typeof SetManualPriceInputSchema>;
export type CreateDiscountInput = z.infer<typeof CreateDiscountInputSchema>;
export type ListDiscountsInput = z.infer<typeof ListDiscountsInputSchema>;
