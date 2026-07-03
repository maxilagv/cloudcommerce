import type { Currency, PriceOrigin, PricingScope, PricingValueKind } from "@cloudcommerce/types";

export type RequestAuditContext = {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  reason?: string | null;
};

export type VariantPricingContext = {
  variantId: string;
  productId: string;
  categoryId: string;
  isActive: boolean;
};

export type PriceListEntity = {
  id: string;
  name: string;
  isDefault: boolean;
  currency: Currency;
};

export type SupplierCostEntity = {
  id: string;
  variantId: string;
  supplierId: string | null;
  costAmountMinor: number;
  currency: Currency;
  validFrom: Date;
  validTo: Date | null;
};

export type MarkupRuleEntity = {
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

export type PriceEntity = {
  id: string;
  variantId: string;
  listId: string;
  amountMinor: number;
  currency: Currency;
  compareAtAmountMinor: number | null;
  origin: PriceOrigin;
  validFrom: Date;
  validTo: Date | null;
};

export type DiscountEntity = {
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

export type SetSupplierCostRecord = {
  variantId: string;
  supplierId: string | null;
  costAmountMinor: number;
  currency: Currency;
  validFrom: Date;
};

export type SetMarkupRuleRecord = {
  scope: PricingScope;
  scopeId: string | null;
  kind: PricingValueKind;
  value: number;
  minMarginBps: number | null;
  createdBy: string | null;
};

export type SetManualPriceRecord = {
  variantId: string;
  listId: string;
  amountMinor: number;
  currency: Currency;
  compareAtAmountMinor: number | null;
  validFrom: Date;
  validTo: Date | null;
  createdBy: string | null;
};

export type CreateDiscountRecord = Omit<DiscountEntity, "id" | "usedCount" | "isActive">;

export class PricingWriteConflictError extends Error {
  public constructor() {
    super("Concurrent pricing write conflict");
    this.name = "PricingWriteConflictError";
  }
}

export interface PricingRepository {
  findVariantContext(variantId: string): Promise<VariantPricingContext | null>;
  findPrimaryVariantByProductId(productId: string): Promise<VariantPricingContext | null>;
  getDefaultPriceList(currency: Currency): Promise<PriceListEntity | null>;
  upsertPriceList(input: Omit<PriceListEntity, "id"> & { id?: string }): Promise<PriceListEntity>;
  getActiveSupplierCost(variantId: string, currency: Currency, at: Date): Promise<SupplierCostEntity | null>;
  setSupplierCost(input: SetSupplierCostRecord, audit: RequestAuditContext): Promise<SupplierCostEntity>;
  findApplicableMarkupRule(context: VariantPricingContext): Promise<MarkupRuleEntity | null>;
  setMarkupRule(input: SetMarkupRuleRecord, audit: RequestAuditContext): Promise<MarkupRuleEntity>;
  getActiveManualPrice(variantId: string, listId: string, currency: Currency, at: Date): Promise<PriceEntity | null>;
  getPreviousPrice(variantId: string, listId: string, currency: Currency, before: Date): Promise<PriceEntity | null>;
  setManualPrice(input: SetManualPriceRecord, audit: RequestAuditContext): Promise<PriceEntity>;
  createDiscount(input: CreateDiscountRecord): Promise<DiscountEntity>;
  listDiscounts(input: { includeInactive: boolean; code?: string }): Promise<DiscountEntity[]>;
  deactivateDiscount(id: string): Promise<DiscountEntity | null>;
}
