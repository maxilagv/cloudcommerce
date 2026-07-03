import { AdminRole, PriceOrigin, PricingScope, PricingValueKind, type Actor } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { PricingWriteConflictError } from "../../application/pricing-repository.js";
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

  it("maps concurrent supplier cost writes for the same variant and currency to a domain conflict", async () => {
    const repository = new ConcurrentSupplierCostRepository();
    const service = new PricingService(repository);

    const results = await Promise.all([
      service.setSupplierCost(admin(AdminRole.ADMIN), { variantId, supplierId: null, costAmountMinor: 1_100_000, currency: "ARS", validFrom: now }, requestContext),
      service.setSupplierCost(admin(AdminRole.ADMIN), { variantId, supplierId: null, costAmountMinor: 1_250_000, currency: "ARS", validFrom: now }, requestContext),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.error.type === "PRICE_CHANGED")).toHaveLength(1);
    expect(repository.openSupplierCostsFor(variantId, "ARS")).toHaveLength(1);
  });

  it("allows concurrent supplier cost writes for different currencies on the same variant", async () => {
    const repository = new ConcurrentSupplierCostRepository();
    const service = new PricingService(repository);

    const results = await Promise.all([
      service.setSupplierCost(admin(AdminRole.ADMIN), { variantId, supplierId: null, costAmountMinor: 1_100_000, currency: "ARS", validFrom: now }, requestContext),
      service.setSupplierCost(admin(AdminRole.ADMIN), { variantId, supplierId: null, costAmountMinor: 900_000, currency: "USD", validFrom: now }, requestContext),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(repository.openSupplierCostsFor(variantId, "ARS")).toHaveLength(1);
    expect(repository.openSupplierCostsFor(variantId, "USD")).toHaveLength(1);
  });

  it("maps manual price open-row write conflicts to PRICE_CHANGED", async () => {
    const service = new PricingService(new ManualPriceConflictRepository());

    const result = await service.setManualPrice(
      admin(AdminRole.ADMIN),
      {
        variantId,
        amountMinor: 1_900_000,
        currency: "ARS",
        compareAtAmountMinor: null,
        validFrom: now,
        validTo: null,
      },
      requestContext,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("PRICE_CHANGED");
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

class ConcurrentSupplierCostRepository extends FakePricingRepository {
  private readonly activeWriteKeys = new Set<string>();
  private readonly supplierCosts: SupplierCostEntity[] = [];

  public override async getActiveSupplierCost(id = variantId, currency: "ARS" | "USD" = "ARS"): Promise<SupplierCostEntity | null> {
    return this.openSupplierCostsFor(id, currency)[0] ?? null;
  }

  public override async setSupplierCost(input: SetSupplierCostRecord): Promise<SupplierCostEntity> {
    const key = `${input.variantId}:${input.currency}`;
    if (this.activeWriteKeys.has(key)) {
      throw new PricingWriteConflictError();
    }
    this.activeWriteKeys.add(key);
    await Promise.resolve();
    try {
      for (const cost of this.supplierCosts) {
        if (cost.variantId === input.variantId && cost.currency === input.currency && cost.validTo === null) {
          cost.validTo = input.validFrom;
        }
      }
      const saved: SupplierCostEntity = {
        id: `supplier-cost-${this.supplierCosts.length + 1}`,
        variantId: input.variantId,
        supplierId: input.supplierId,
        costAmountMinor: input.costAmountMinor,
        currency: input.currency,
        validFrom: input.validFrom,
        validTo: null,
      };
      this.supplierCosts.push(saved);
      return saved;
    } finally {
      this.activeWriteKeys.delete(key);
    }
  }

  public openSupplierCostsFor(id: string, currency: "ARS" | "USD"): SupplierCostEntity[] {
    return this.supplierCosts.filter((cost) => cost.variantId === id && cost.currency === currency && cost.validTo === null);
  }
}

class ManualPriceConflictRepository extends FakePricingRepository {
  public override async setManualPrice(): Promise<PriceEntity> {
    throw new PricingWriteConflictError();
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
