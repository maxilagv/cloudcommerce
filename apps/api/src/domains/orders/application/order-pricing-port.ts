import type { Currency, PriceTier } from "@cloudcommerce/types";

export type OrderPriceSnapshot = {
  variantId: string;
  unitPriceMinor: number;
  supplierCostMinor: number | null;
  /** Proveedor del costo vigente al momento de la venta (para rebates). */
  supplierId: string | null;
  compareAtAmountMinor: number | null;
  /** Tramo aplicado según la cantidad (RETAIL o WHOLESALE). */
  appliedTier: PriceTier;
  currency: Currency;
};

export interface OrderPricingPort {
  getSnapshot(input: {
    variantId: string;
    currency: Currency;
    /** Cantidad de la línea — decide el tramo minorista/mayorista. */
    quantity: number;
  }): Promise<OrderPriceSnapshot | null>;
}
