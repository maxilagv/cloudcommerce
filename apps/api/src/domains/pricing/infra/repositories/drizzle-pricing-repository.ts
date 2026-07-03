import {
  auditLog,
  discount,
  markupRule,
  outboxEvent,
  price,
  priceList,
  product,
  productVariant,
  supplierCost,
} from "@cloudcommerce/database";
import { PriceOrigin, PricingScope, type Currency } from "@cloudcommerce/types";
import { and, desc, eq, gt, isNull, lte, or, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import { PricingWriteConflictError } from "../../application/pricing-repository.js";
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

export class DrizzlePricingRepository implements PricingRepository {
  public constructor(private readonly db: Database) {}

  public async findVariantContext(variantId: string): Promise<VariantPricingContext | null> {
    const [row] = await this.db
      .select({
        variantId: productVariant.id,
        productId: product.id,
        categoryId: product.categoryId,
        isActive: productVariant.isActive,
      })
      .from(productVariant)
      .innerJoin(product, eq(productVariant.productId, product.id))
      .where(eq(productVariant.id, variantId))
      .limit(1);
    return row ?? null;
  }

  public async findPrimaryVariantByProductId(productId: string): Promise<VariantPricingContext | null> {
    const [row] = await this.db
      .select({
        variantId: productVariant.id,
        productId: product.id,
        categoryId: product.categoryId,
        isActive: productVariant.isActive,
      })
      .from(productVariant)
      .innerJoin(product, eq(productVariant.productId, product.id))
      .where(and(eq(productVariant.productId, productId), eq(productVariant.isActive, true)))
      .orderBy(productVariant.position)
      .limit(1);
    return row ?? null;
  }

  public async getDefaultPriceList(currency: Currency): Promise<PriceListEntity | null> {
    const row = await this.db.query.priceList.findFirst({
      where: and(eq(priceList.currency, currency), eq(priceList.isDefault, true)),
    });
    return row ? this.mapPriceList(row) : null;
  }

  public async upsertPriceList(input: Omit<PriceListEntity, "id"> & { id?: string }): Promise<PriceListEntity> {
    if (input.isDefault) {
      await this.db.update(priceList).set({ isDefault: false }).where(eq(priceList.currency, input.currency));
    }
    const [row] = await this.db
      .insert(priceList)
      .values({
        id: input.id ?? uuidv7(),
        name: input.name,
        currency: input.currency,
        isDefault: input.isDefault,
      })
      .onConflictDoUpdate({
        target: priceList.name,
        set: {
          currency: input.currency,
          isDefault: input.isDefault,
        },
      })
      .returning();
    if (!row) {
      throw new Error("Failed to upsert price list");
    }
    return this.mapPriceList(row);
  }

  public async getActiveSupplierCost(variantId: string, currency: Currency, at: Date): Promise<SupplierCostEntity | null> {
    const row = await this.db.query.supplierCost.findFirst({
      where: and(
        eq(supplierCost.variantId, variantId),
        eq(supplierCost.currency, currency),
        lte(supplierCost.validFrom, at),
        or(isNull(supplierCost.validTo), gt(supplierCost.validTo, at)),
      ),
      orderBy: [desc(supplierCost.validFrom)],
    });
    return row ? this.mapSupplierCost(row) : null;
  }

  public async setSupplierCost(input: SetSupplierCostRecord, audit: RequestAuditContext): Promise<SupplierCostEntity> {
    return this.retryOpenRowWrite(() => this.insertSupplierCost(input, audit));
  }

  private async insertSupplierCost(input: SetSupplierCostRecord, audit: RequestAuditContext): Promise<SupplierCostEntity> {
    return this.db.transaction(async (tx) => {
      const previous = await tx.query.supplierCost.findFirst({
        where: and(eq(supplierCost.variantId, input.variantId), eq(supplierCost.currency, input.currency), isNull(supplierCost.validTo)),
        orderBy: [desc(supplierCost.validFrom)],
      });
      await tx
        .update(supplierCost)
        .set({ validTo: input.validFrom })
        .where(and(eq(supplierCost.variantId, input.variantId), eq(supplierCost.currency, input.currency), isNull(supplierCost.validTo)));
      const [row] = await tx
        .insert(supplierCost)
        .values({
          id: uuidv7(),
          variantId: input.variantId,
          supplierId: input.supplierId,
          costAmountMinor: input.costAmountMinor,
          currency: input.currency,
          validFrom: input.validFrom,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to set supplier cost");
      }
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "supplier_cost.set",
        resourceType: "product_variant",
        resourceId: input.variantId,
        before: previous ? { costAmountMinor: previous.costAmountMinor, currency: previous.currency } : null,
        after: { costAmountMinor: input.costAmountMinor, currency: input.currency },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "pricing",
        aggregateId: input.variantId,
        eventType: "PriceChanged",
        payload: { variantId: input.variantId, reason: "supplier_cost_changed" },
      });
      return this.mapSupplierCost(row);
    });
  }

  public async findApplicableMarkupRule(context: VariantPricingContext): Promise<MarkupRuleEntity | null> {
    const productRule = await this.findActiveRule(PricingScope.PRODUCT, context.productId);
    if (productRule) {
      return productRule;
    }
    const categoryRule = await this.findActiveRule(PricingScope.CATEGORY, context.categoryId);
    if (categoryRule) {
      return categoryRule;
    }
    return this.findActiveRule(PricingScope.GLOBAL, null);
  }

  public async setMarkupRule(input: SetMarkupRuleRecord, audit: RequestAuditContext): Promise<MarkupRuleEntity> {
    return this.db.transaction(async (tx) => {
      if (input.scope !== PricingScope.GLOBAL && input.scopeId === null) {
        throw new Error("Scoped markup rule requires scopeId");
      }
      const scopedId = input.scopeId ?? "00000000-0000-0000-0000-000000000000";
      const scopePredicate =
        input.scope === PricingScope.GLOBAL
          ? and(eq(markupRule.scope, input.scope), isNull(markupRule.scopeId))
          : and(eq(markupRule.scope, input.scope), eq(markupRule.scopeId, scopedId));
      const previous = await tx.query.markupRule.findFirst({
        where: and(scopePredicate, eq(markupRule.isActive, true)),
      });
      await tx.update(markupRule).set({ isActive: false }).where(and(scopePredicate, eq(markupRule.isActive, true)));
      const [row] = await tx
        .insert(markupRule)
        .values({
          id: uuidv7(),
          scope: input.scope,
          scopeId: input.scopeId,
          kind: input.kind,
          value: input.value,
          minMarginBps: input.minMarginBps,
          isActive: true,
          createdBy: input.createdBy,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to set markup rule");
      }
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "markup_rule.set",
        resourceType: "markup_rule",
        resourceId: row.id,
        before: previous ? { id: previous.id, value: previous.value, minMarginBps: previous.minMarginBps } : null,
        after: { id: row.id, value: row.value, minMarginBps: row.minMarginBps },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "pricing",
        aggregateId: row.id,
        eventType: "MarkupRuleChanged",
        payload: { ruleId: row.id, scope: row.scope, scopeId: row.scopeId },
      });
      return this.mapMarkupRule(row);
    });
  }

  public async getActiveManualPrice(variantId: string, listId: string, currency: Currency, at: Date): Promise<PriceEntity | null> {
    const row = await this.db.query.price.findFirst({
      where: and(
        eq(price.variantId, variantId),
        eq(price.listId, listId),
        eq(price.currency, currency),
        eq(price.origin, PriceOrigin.MANUAL),
        lte(price.validFrom, at),
        or(isNull(price.validTo), gt(price.validTo, at)),
      ),
      orderBy: [desc(price.validFrom)],
    });
    return row ? this.mapPrice(row) : null;
  }

  public async getPreviousPrice(variantId: string, listId: string, currency: Currency, before: Date): Promise<PriceEntity | null> {
    const row = await this.db.query.price.findFirst({
      where: and(eq(price.variantId, variantId), eq(price.listId, listId), eq(price.currency, currency), lte(price.validFrom, before)),
      orderBy: [desc(price.validFrom)],
    });
    return row ? this.mapPrice(row) : null;
  }

  public async setManualPrice(input: SetManualPriceRecord, audit: RequestAuditContext): Promise<PriceEntity> {
    return this.retryOpenRowWrite(() => this.insertManualPrice(input, audit));
  }

  private async insertManualPrice(input: SetManualPriceRecord, audit: RequestAuditContext): Promise<PriceEntity> {
    return this.db.transaction(async (tx) => {
      const previous = await tx.query.price.findFirst({
        where: and(eq(price.variantId, input.variantId), eq(price.listId, input.listId), eq(price.currency, input.currency), isNull(price.validTo)),
        orderBy: [desc(price.validFrom)],
      });
      await tx
        .update(price)
        .set({ validTo: input.validFrom })
        .where(and(eq(price.variantId, input.variantId), eq(price.listId, input.listId), eq(price.currency, input.currency), isNull(price.validTo)));
      const [row] = await tx
        .insert(price)
        .values({
          id: uuidv7(),
          variantId: input.variantId,
          listId: input.listId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          compareAtAmountMinor: input.compareAtAmountMinor,
          origin: PriceOrigin.MANUAL,
          validFrom: input.validFrom,
          validTo: input.validTo,
          createdBy: input.createdBy,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to set manual price");
      }
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "price.manual_set",
        resourceType: "product_variant",
        resourceId: input.variantId,
        before: previous ? { amountMinor: previous.amountMinor, currency: previous.currency } : null,
        after: { amountMinor: input.amountMinor, currency: input.currency },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "pricing",
        aggregateId: input.variantId,
        eventType: "PriceChanged",
        payload: { variantId: input.variantId, reason: "manual_price_changed" },
      });
      return this.mapPrice(row);
    });
  }

  public async createDiscount(input: CreateDiscountRecord): Promise<DiscountEntity> {
    const [row] = await this.db
      .insert(discount)
      .values({
        id: uuidv7(),
        code: input.code,
        scope: input.scope,
        scopeId: input.scopeId,
        kind: input.kind,
        value: input.value,
        validFrom: input.validFrom,
        validTo: input.validTo,
        maxUses: input.maxUses,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to create discount");
    }
    return this.mapDiscount(row);
  }

  public async listDiscounts(input: { includeInactive: boolean; code?: string }): Promise<DiscountEntity[]> {
    const conditions: SQL[] = [];
    if (!input.includeInactive) {
      conditions.push(eq(discount.isActive, true));
    }
    if (input.code) {
      conditions.push(eq(discount.code, input.code));
    }
    const rows =
      conditions.length > 0
        ? await this.db.select().from(discount).where(and(...conditions)).orderBy(desc(discount.validFrom))
        : await this.db.select().from(discount).orderBy(desc(discount.validFrom));
    return rows.map((row) => this.mapDiscount(row));
  }

  public async deactivateDiscount(id: string): Promise<DiscountEntity | null> {
    const [row] = await this.db.update(discount).set({ isActive: false }).where(eq(discount.id, id)).returning();
    return row ? this.mapDiscount(row) : null;
  }

  private async findActiveRule(scope: PricingScope, scopeId: string | null): Promise<MarkupRuleEntity | null> {
    if (scope === PricingScope.GLOBAL) {
      const row = await this.db.query.markupRule.findFirst({
        where: and(eq(markupRule.scope, scope), isNull(markupRule.scopeId), eq(markupRule.isActive, true)),
        orderBy: [desc(markupRule.createdAt)],
      });
      return row ? this.mapMarkupRule(row) : null;
    }
    if (scopeId === null) {
      return null;
    }
    const row = await this.db.query.markupRule.findFirst({
      where: and(eq(markupRule.scope, scope), eq(markupRule.scopeId, scopeId), eq(markupRule.isActive, true)),
      orderBy: [desc(markupRule.createdAt)],
    });
    return row ? this.mapMarkupRule(row) : null;
  }

  private mapPriceList(row: typeof priceList.$inferSelect): PriceListEntity {
    return {
      id: row.id,
      name: row.name,
      isDefault: row.isDefault,
      currency: this.currency(row.currency),
    };
  }

  private mapSupplierCost(row: typeof supplierCost.$inferSelect): SupplierCostEntity {
    return {
      id: row.id,
      variantId: row.variantId,
      supplierId: row.supplierId,
      costAmountMinor: row.costAmountMinor,
      currency: this.currency(row.currency),
      validFrom: row.validFrom,
      validTo: row.validTo,
    };
  }

  private mapMarkupRule(row: typeof markupRule.$inferSelect): MarkupRuleEntity {
    return {
      id: row.id,
      scope: row.scope,
      scopeId: row.scopeId,
      kind: row.kind,
      value: row.value,
      minMarginBps: row.minMarginBps,
      isActive: row.isActive,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
  }

  private mapPrice(row: typeof price.$inferSelect): PriceEntity {
    return {
      id: row.id,
      variantId: row.variantId,
      listId: row.listId,
      amountMinor: row.amountMinor,
      currency: this.currency(row.currency),
      compareAtAmountMinor: row.compareAtAmountMinor,
      origin: row.origin,
      validFrom: row.validFrom,
      validTo: row.validTo,
    };
  }

  private mapDiscount(row: typeof discount.$inferSelect): DiscountEntity {
    return {
      id: row.id,
      code: row.code,
      scope: row.scope,
      scopeId: row.scopeId,
      kind: row.kind,
      value: row.value,
      validFrom: row.validFrom,
      validTo: row.validTo,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      isActive: row.isActive,
    };
  }

  private currency(value: string): Currency {
    return value === "USD" ? "USD" : "ARS";
  }

  private async retryOpenRowWrite<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!isOpenPricingRowUniqueViolation(error)) {
          throw error;
        }
        if (attempt === 1) {
          throw new PricingWriteConflictError();
        }
      }
    }
    throw new PricingWriteConflictError();
  }
}

const openPricingRowUniqueConstraints = new Set([
  "supplier_cost_one_open_per_variant_currency_unique",
  "supplier_cost_one_open_per_variant_unique",
  "price_one_open_per_variant_list_unique",
]);

const isOpenPricingRowUniqueViolation = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as { code?: unknown; constraint?: unknown; message?: unknown; detail?: unknown };
  if (candidate.code !== "23505") {
    return false;
  }
  if (typeof candidate.constraint === "string" && openPricingRowUniqueConstraints.has(candidate.constraint)) {
    return true;
  }
  const text = `${typeof candidate.message === "string" ? candidate.message : ""} ${typeof candidate.detail === "string" ? candidate.detail : ""}`;
  return [...openPricingRowUniqueConstraints].some((constraint) => text.includes(constraint));
};
