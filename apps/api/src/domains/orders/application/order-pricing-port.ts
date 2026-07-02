import type { Currency } from "@cloudcommerce/types";

export type OrderPriceSnapshot = {
  variantId: string;
  unitPriceMinor: number;
  supplierCostMinor: number | null;
  compareAtAmountMinor: number | null;
  currency: Currency;
};

export interface OrderPricingPort {
  getSnapshot(input: { variantId: string; currency: Currency }): Promise<OrderPriceSnapshot | null>;
}
