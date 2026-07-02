import type { Currency, Money } from "./domain.js";
import type { PriceOrigin, PricingScope, PricingValueKind } from "./enums.js";

export type PriceListResponse = {
  id: string;
  name: string;
  currency: Currency;
  isDefault: boolean;
};

export type SupplierCostResponse = {
  id: string;
  variantId: string;
  supplierId: string | null;
  cost: Money;
  validFrom: Date;
  validTo: Date | null;
};

export type MarkupRuleResponse = {
  id: string;
  scope: PricingScope;
  scopeId: string | null;
  kind: PricingValueKind;
  value: number;
  minMarginBps: number | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Date;
};

export type DiscountResponse = {
  id: string;
  code: string | null;
  scope: PricingScope;
  scopeId: string | null;
  kind: PricingValueKind;
  value: number;
  validFrom: Date;
  validTo: Date | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
};

export type PriceBreakdownPublic = {
  variantId: string;
  price: Money;
  compareAtPrice: Money | null;
  origin: PriceOrigin;
  validFrom: Date;
  validTo: Date | null;
};

export type PriceBreakdownInternal = PriceBreakdownPublic & {
  supplierCost: Money;
  markupRule: MarkupRuleResponse | null;
  marginMinor: number;
  marginBps: number;
};

export type PriceBreakdownResponse = PriceBreakdownPublic | PriceBreakdownInternal;
