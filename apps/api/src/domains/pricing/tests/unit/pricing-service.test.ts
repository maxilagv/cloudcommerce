import { AdminRole, PriceOrigin, PricingScope, PricingValueKind, type Actor } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { PricingService } from "../../application/pricing-service.js";
import type {
  CreateDiscountRecord,
  DiscountEntity,
  MarkupRuleEntity,
  PriceEntity,
  PriceListEntity,
  PricingRepository,
  RequestAuditContext,
  SetManualPriceRecord,
  SetMarkupRuleRecord,
  SetSupplierCostRecord,
  SupplierCostEntity,
  VariantPricingContext,
} from "../../application/pricing-repository.js";

const now = new Date("2026-07-01T00:00:00.000Z");
const variantId = "66666666-6666-4666-8666-666666666661";
const productId = "44444444-4444-4444-8444-444444444444";
const categoryId = "11111111-1111-4111-8111-111111111114";

describe("PricingService", () => {
  it("does not expose supplier cost to CATALOG_MANAGER", async () => {
    const service = new PricingService(new FakePricingRepository());
    const result = await service.computeSalePrice(admin(AdminRole.CATALOG_MANAGER), { variantId, currency: "ARS" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.price.amountMinor).toBe(1_800_000);
      expect("supplierCost" in result.value).toBe(false);
    }
  });

  it("rejects manual prices below configured minimum margin", async () => {
    const service = new PricingService(new FakePricingRepository());
    const result = await service.setManualPrice(
      admin(AdminRole.ADMIN),
      {
        variantId,
        amountMinor: 1_320_000,
        currency: "ARS",
        compareAtAmountMinor: null,
        validFrom: now,
        validTo: null,
      },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("MARGIN_BELOW_MINIMUM");
    }
  });

  it("rejects supplier cost writes from CATALOG_MANAGER", async () => {
    const service = new PricingService(new FakePricingRepository());
    const result = await service.setSupplierCost(
      admin(AdminRole.CATALOG_MANAGER),
      { variantId, supplierId: null, costAmountMinor: 1_200_000, currency: "ARS", validFrom: now },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });
});

const admin = (role: AdminRole): Actor => ({
  kind: "admin",
  userId: "admin-user",
  role,
  sessionId: "session",
});

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "request-id",
};

class FakePricingRepository implements PricingRepository {
  public async findVariantContext(id: string): Promise<VariantPricingContext | null> {
    return id === variantId ? { variantId, productId, categoryId, isActive: true } : null;
  }

  public async findPrimaryVariantByProductId(id: string): Promise<VariantPricingContext | null> {
    return id === productId ? { variantId, productId, categoryId, isActive: true } : null;
  }

  public async getDefaultPriceList(): Promise<PriceListEntity | null> {
    return priceList;
  }

  public async upsertPriceList(): Promise<PriceListEntity> {
    return priceList;
  }

  public async getActiveSupplierCost(): Promise<SupplierCostEntity | null> {
    return supplierCost;
  }

  public async setSupplierCost(_input: SetSupplierCostRecord, _audit: RequestAuditContext): Promise<SupplierCostEntity> {
    return supplierCost;
  }

  public async findApplicableMarkupRule(): Promise<MarkupRuleEntity | null> {
    return markupRule;
  }

  public async setMarkupRule(_input: SetMarkupRuleRecord, _audit: RequestAuditContext): Promise<MarkupRuleEntity> {
    return markupRule;
  }

  public async getActiveManualPrice(): Promise<PriceEntity | null> {
    return null;
  }

  public async getPreviousPrice(): Promise<PriceEntity | null> {
    return null;
  }

  public async setManualPrice(_input: SetManualPriceRecord, _audit: RequestAuditContext): Promise<PriceEntity> {
    return {
      id: "price",
      variantId,
      listId: priceList.id,
      amountMinor: _input.amountMinor,
      currency: _input.currency,
      compareAtAmountMinor: _input.compareAtAmountMinor,
      origin: PriceOrigin.MANUAL,
      validFrom: _input.validFrom,
      validTo: _input.validTo,
    };
  }

  public async createDiscount(_input: CreateDiscountRecord): Promise<DiscountEntity> {
    throw new Error("unexpected");
  }

  public async listDiscounts(_input: { includeInactive: boolean; code?: string }): Promise<DiscountEntity[]> {
    return [];
  }

  public async deactivateDiscount(_id: string): Promise<DiscountEntity | null> {
    return null;
  }
}

const priceList: PriceListEntity = {
  id: "77777777-7777-4777-8777-777777777771",
  name: "ARS Default",
  isDefault: true,
  currency: "ARS",
};

const supplierCost: SupplierCostEntity = {
  id: "88888888-8888-4888-8888-888888888882",
  variantId,
  supplierId: null,
  costAmountMinor: 1_200_000,
  currency: "ARS",
  validFrom: now,
  validTo: null,
};

const markupRule: MarkupRuleEntity = {
  id: "77777777-7777-4777-8777-777777777772",
  scope: PricingScope.GLOBAL,
  scopeId: null,
  kind: PricingValueKind.PERCENT,
  value: 5_000,
  minMarginBps: 2_500,
  isActive: true,
  createdBy: null,
  createdAt: now,
};
