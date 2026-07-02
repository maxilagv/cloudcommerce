import { AdminRole, type Actor, type PriceBreakdownInternal } from "@cloudcommerce/types";
import type { PricingService } from "../../../pricing/application/pricing-service.js";
import type { OrderPriceSnapshot, OrderPricingPort } from "../../application/order-pricing-port.js";

const internalPricingActor: Actor = {
  kind: "admin",
  userId: "00000000-0000-0000-0000-000000000000",
  role: AdminRole.FINANCE,
  sessionId: "orders-internal-pricing",
};

export class PricingOrderPricingPort implements OrderPricingPort {
  public constructor(private readonly pricing: PricingService) {}

  public async getSnapshot(input: { variantId: string; currency: "ARS" | "USD" }): Promise<OrderPriceSnapshot | null> {
    const result = await this.pricing.computeSalePrice(internalPricingActor, input);
    if (!result.ok) {
      return null;
    }
    if (!hasSupplierCost(result.value)) {
      return null;
    }
    return {
      variantId: result.value.variantId,
      unitPriceMinor: result.value.price.amountMinor,
      supplierCostMinor: result.value.supplierCost.amountMinor,
      compareAtAmountMinor: result.value.compareAtPrice?.amountMinor ?? null,
      currency: result.value.price.currency,
    };
  }
}

const hasSupplierCost = (value: unknown): value is PriceBreakdownInternal =>
  typeof value === "object" && value !== null && "supplierCost" in value;
