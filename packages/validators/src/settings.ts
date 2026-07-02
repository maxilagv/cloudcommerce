import { AdminRole, PaymentMethodId, ShippingMethod, type SettingKey } from "@cloudcommerce/types";
import { z } from "zod";
import { ReasonSchema, UuidSchema } from "./common.js";

const optionalUrlSchema = z.string().trim().url().optional();
const cuitSchema = z.string().trim().regex(/^\d{2}-\d{8}-\d$/);

export const SettingKeySchema = z.enum([
  "store.identity",
  "store.currency",
  "store.billing",
  "store.legal.terms",
  "store.legal.privacy",
  "store.social",
  "shipping.options",
  "shipping.coverage",
  "payments.methods",
  "checkout.policy",
]);

export const StoreIdentitySettingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  legalName: z.string().trim().min(1).max(160).optional(),
  cuit: cuitSchema.optional(),
  logoAssetId: UuidSchema.optional(),
}).strict();

export const StoreCurrencySettingsSchema = z.object({
  base: z.literal("ARS"),
  display: z.string().trim().min(2).max(20).default("es-AR"),
  rounding: z.enum(["none", "nearest_100", "nearest_1000"]).default("nearest_100"),
}).strict();

export const StoreBillingSettingsSchema = z.object({
  legalName: z.string().trim().min(1).max(160),
  cuit: cuitSchema,
  ivaCondition: z.string().trim().min(1).max(80),
  fiscalAddress: z.string().trim().min(1).max(240),
  salesPoint: z.string().trim().min(1).max(20).optional(),
}).strict();

export const LegalTextSettingsSchema = z.object({
  markdown: z.string().trim().min(1).max(50_000),
  version: z.string().trim().min(1).max(40),
  updatedAt: z.string().datetime(),
}).strict();

export const StoreSocialSettingsSchema = z.object({
  instagram: optionalUrlSchema,
  facebook: optionalUrlSchema,
  whatsapp: z.string().trim().min(5).max(40).optional(),
  tiktok: optionalUrlSchema,
  x: optionalUrlSchema,
}).strict();

export const ShippingOptionConfigSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  method: z.nativeEnum(ShippingMethod),
  label: z.string().trim().min(1).max(60),
  detail: z.string().trim().max(120),
  costAmountMinor: z.number().int().min(0),
  currency: z.literal("ARS"),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  position: z.number().int().min(0).max(1_000).default(0),
}).strict();

export const ShippingCoverageSettingsSchema = z.object({
  provinces: z.array(z.string().trim().min(1).max(80)).min(1).max(24),
  cities: z.array(z.string().trim().min(1).max(120)).min(1).max(200),
  defaultCity: z.string().trim().min(1).max(120),
}).strict();

export const PaymentMethodConfigSchema = z.object({
  id: z.nativeEnum(PaymentMethodId),
  label: z.string().trim().min(1).max(40),
  provider: z.enum(["stripe", "mercadopago", "modo", "offline"]),
  isEnabled: z.boolean(),
  position: z.number().int().min(0).max(1_000),
  credentialsRef: z.string().trim().startsWith("sm://").max(160).optional(),
  surchargePct: z.number().min(0).max(100).optional(),
  installmentsMax: z.number().int().min(1).max(24).optional(),
}).strict();

export const CheckoutPolicySettingsSchema = z.object({
  minOrderAmountMinor: z.number().int().min(0).optional(),
  allowGuest: z.boolean().default(true),
}).strict();

export const SETTING_SCHEMAS = {
  "store.identity": StoreIdentitySettingsSchema,
  "store.currency": StoreCurrencySettingsSchema,
  "store.billing": StoreBillingSettingsSchema,
  "store.legal.terms": LegalTextSettingsSchema,
  "store.legal.privacy": LegalTextSettingsSchema,
  "store.social": StoreSocialSettingsSchema,
  "shipping.options": z.array(ShippingOptionConfigSchema).min(1).max(20),
  "shipping.coverage": ShippingCoverageSettingsSchema,
  "payments.methods": z.array(PaymentMethodConfigSchema).min(1).max(20),
  "checkout.policy": CheckoutPolicySettingsSchema,
} satisfies Record<SettingKey, z.ZodType>;

export const GetSettingsSchema = z.object({
  keys: z.array(SettingKeySchema).min(1).max(20).optional(),
});

export const UpdateSettingSchema = z.object({
  key: SettingKeySchema,
  value: z.unknown(),
  reason: ReasonSchema.optional(),
});

export const ListShippingOptionsSchema = z.object({
  includeInactive: z.boolean().default(false),
});

export const UpsertShippingOptionSchema = ShippingOptionConfigSchema.extend({
  reason: ReasonSchema.optional(),
});

export const ListPaymentMethodsSchema = z.object({
  includeDisabled: z.boolean().default(true),
});

export const TogglePaymentMethodSchema = z.object({
  id: z.nativeEnum(PaymentMethodId),
  isEnabled: z.boolean(),
  reason: ReasonSchema.optional(),
});

export const ListAdminUsersSchema = z.object({
  role: z.nativeEnum(AdminRole).optional(),
  isActive: z.boolean().optional(),
  search: z.string().trim().min(1).max(120).optional(),
  cursor: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const InviteAdminUserSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(1).max(120),
  role: z.nativeEnum(AdminRole),
  reason: ReasonSchema.optional(),
});

export const SetAdminUserRoleSchema = z.object({
  userId: UuidSchema,
  role: z.nativeEnum(AdminRole),
  reason: ReasonSchema.optional(),
});

export const DeactivateAdminUserSchema = z.object({
  userId: UuidSchema,
  reason: ReasonSchema,
});

export const ListFeatureFlagsSchema = z.object({
  enabled: z.boolean().optional(),
  owner: z.string().trim().min(1).max(120).optional(),
});

export const ToggleFeatureFlagSchema = z.object({
  key: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
  enabled: z.boolean(),
  reason: ReasonSchema.optional(),
});

export const UpsertFeatureFlagSchema = z.object({
  key: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
  enabled: z.boolean().default(false),
  owner: z.string().trim().min(1).max(120),
  reviewAt: z.string().date(),
  removalPlan: z.string().trim().min(1).max(500).optional(),
  isTemporary: z.boolean().default(false),
  description: z.string().trim().min(1).max(500),
  reason: ReasonSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.isTemporary && !value.removalPlan) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["removalPlan"],
      message: "Los feature flags temporales requieren plan de eliminacion.",
    });
  }
});

export type GetSettingsInput = z.infer<typeof GetSettingsSchema>;
export type UpdateSettingInput = z.infer<typeof UpdateSettingSchema>;
export type ListShippingOptionsInput = z.infer<typeof ListShippingOptionsSchema>;
export type UpsertShippingOptionInput = z.infer<typeof UpsertShippingOptionSchema>;
export type ListPaymentMethodsInput = z.infer<typeof ListPaymentMethodsSchema>;
export type TogglePaymentMethodInput = z.infer<typeof TogglePaymentMethodSchema>;
export type ListAdminUsersInput = z.infer<typeof ListAdminUsersSchema>;
export type InviteAdminUserInput = z.infer<typeof InviteAdminUserSchema>;
export type SetAdminUserRoleInput = z.infer<typeof SetAdminUserRoleSchema>;
export type DeactivateAdminUserInput = z.infer<typeof DeactivateAdminUserSchema>;
export type ListFeatureFlagsInput = z.infer<typeof ListFeatureFlagsSchema>;
export type ToggleFeatureFlagInput = z.infer<typeof ToggleFeatureFlagSchema>;
export type UpsertFeatureFlagInput = z.infer<typeof UpsertFeatureFlagSchema>;
