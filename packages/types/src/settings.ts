import type { AdminRole, PaymentMethodId, ShippingMethod } from "./enums.js";

export type SettingScope = "business" | "public";

export type SettingKey =
  | "store.identity"
  | "store.currency"
  | "store.billing"
  | "store.legal.terms"
  | "store.legal.privacy"
  | "store.social"
  | "shipping.options"
  | "shipping.coverage"
  | "payments.methods"
  | "checkout.policy";

export type StoreIdentitySettings = {
  name: string;
  legalName?: string;
  cuit?: string;
  logoAssetId?: string;
};

export type StoreCurrencySettings = {
  base: "ARS";
  display: string;
  rounding: "none" | "nearest_100" | "nearest_1000";
};

export type StoreBillingSettings = {
  legalName: string;
  cuit: string;
  ivaCondition: string;
  fiscalAddress: string;
  salesPoint?: string;
};

export type LegalTextSettings = {
  markdown: string;
  version: string;
  updatedAt: string;
};

export type StoreSocialSettings = {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  tiktok?: string;
  x?: string;
};

export type ShippingOptionConfig = {
  id: string;
  method: ShippingMethod;
  label: string;
  detail: string;
  costAmountMinor: number;
  currency: "ARS";
  isActive: boolean;
  isDefault: boolean;
  position: number;
};

export type ShippingCoverageSettings = {
  provinces: string[];
  cities: string[];
  defaultCity: string;
};

export type PaymentProvider = "stripe" | "mercadopago" | "modo" | "offline";

export type PaymentMethodConfig = {
  id: PaymentMethodId;
  label: string;
  provider: PaymentProvider;
  isEnabled: boolean;
  position: number;
  credentialsRef?: string;
  surchargePct?: number;
  installmentsMax?: number;
};

export type CheckoutPolicySettings = {
  minOrderAmountMinor?: number;
  allowGuest: boolean;
};

export type SettingValue =
  | StoreIdentitySettings
  | StoreCurrencySettings
  | StoreBillingSettings
  | LegalTextSettings
  | StoreSocialSettings
  | ShippingOptionConfig[]
  | ShippingCoverageSettings
  | PaymentMethodConfig[]
  | CheckoutPolicySettings;

export type SettingRecord = {
  key: SettingKey;
  scope: SettingScope;
  value: SettingValue;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
};

export type AdminUserSummary = {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListResult = {
  items: AdminUserSummary[];
  nextCursor: string | null;
};

export type AdminInviteResult = {
  accepted: true;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  owner: string;
  reviewAt: string;
  removalPlan: string | null;
  description: string;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
};

export type FeatureFlagListResult = {
  items: FeatureFlag[];
};
