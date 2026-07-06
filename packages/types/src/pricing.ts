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

/** Tramo de precio aplicado según la cantidad comprada. */
export type PriceTier = "RETAIL" | "WHOLESALE";

export type PriceBreakdownPublic = {
  variantId: string;
  price: Money;
  compareAtPrice: Money | null;
  origin: PriceOrigin;
  appliedTier: PriceTier;
  validFrom: Date;
  validTo: Date | null;
};

export type PriceBreakdownInternal = PriceBreakdownPublic & {
  supplierCost: Money;
  supplierId: string | null;
  markupRule: MarkupRuleResponse | null;
  marginMinor: number;
  marginBps: number;
};

export type PriceBreakdownResponse = PriceBreakdownPublic | PriceBreakdownInternal;

// ---------------------------------------------------------------------------
// Modo reventa (dropshipping): minorista con margen vs mayorista = costo.
// ---------------------------------------------------------------------------

export type ResaleConfig = {
  /** Habilita el tramo mayorista por cantidad. */
  wholesaleEnabled: boolean;
  /** Cantidad mínima de unidades para pagar precio mayorista. */
  wholesaleMinQty: number;
  /** Margen sobre el costo en el tramo mayorista (bps; 0 = precio proveedor). */
  wholesaleMarginBps: number;
  /** Permite vender sin stock (backorder puro, operación de reventa). */
  allowBackorder: boolean;
};

/** Fila del reporte de liquidaciones: ventas por proveedor en un período. */
export type SupplierRebateRow = {
  supplierId: string | null;
  supplierName: string | null;
  rebateBps: number;
  orders: number;
  unitsSold: number;
  salesMinor: number;
  supplierCostMinor: number;
  /** Comisión esperada = ventas × rebate del proveedor. */
  expectedRebateMinor: number;
};
