import { brand, category, markupRule, price, product, productVariant, specGroup, specItem, supplierCost } from "@cloudcommerce/database";
import { ProductStatus, type AiRecommendation } from "@cloudcommerce/types";
import { and, desc, eq, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  AiCatalogCandidate,
  AiCategoryContext,
  AiContextReaderPort,
  AiPricingContext,
  AiProductContext,
} from "../../application/ports.js";

/**
 * Read model autorizado sobre catalog/pricing. Construye el contexto MÍNIMO que
 * puede viajar a la IA: nunca selecciona PII, credenciales ni notas internas.
 * El costo proveedor solo se expone vía getPricingContexts, cuyo caso de uso
 * ya validó el permiso del actor.
 */
export class AiContextReadModel implements AiContextReaderPort {
  public constructor(private readonly db: Database) {}

  public async getProductContext(productId: string): Promise<AiProductContext | null> {
    const [row] = await this.db
      .select({
        id: product.id,
        title: product.title,
        subtitle: product.subtitle,
        description: product.description,
        categoryName: category.name,
        brandName: brand.name,
      })
      .from(product)
      .innerJoin(category, eq(product.categoryId, category.id))
      .leftJoin(brand, eq(product.brandId, brand.id))
      .where(and(eq(product.id, productId), isNull(product.deletedAt)));
    if (!row) {
      return null;
    }
    const specs = await this.db
      .select({
        key: specItem.key,
        label: specItem.label,
        valueText: specItem.valueText,
        valueNum: specItem.valueNum,
        unit: specItem.unit,
      })
      .from(specItem)
      .innerJoin(specGroup, eq(specItem.specGroupId, specGroup.id))
      .where(eq(specGroup.productId, productId))
      .orderBy(specGroup.position, specItem.position);
    const variants = await this.db
      .select({ attributes: productVariant.attributes })
      .from(productVariant)
      .where(and(eq(productVariant.productId, productId), eq(productVariant.isActive, true)));
    return {
      productId: row.id,
      title: row.title,
      subtitle: row.subtitle,
      description: row.description,
      categoryName: row.categoryName,
      brandName: row.brandName,
      specs: specs.map((item) => ({
        key: item.key,
        label: item.label,
        valueText: item.valueText,
        valueNum: item.valueNum === null ? null : Number(item.valueNum),
        unit: item.unit,
      })),
      variantAttributes: variants.map((variant) => sanitizeAttributes(variant.attributes)),
    };
  }

  public async getCategoryContext(categoryId: string): Promise<AiCategoryContext | null> {
    const row = await this.db.query.category.findFirst({ where: eq(category.id, categoryId) });
    return row ? { categoryId: row.id, name: row.name, description: row.description } : null;
  }

  public async listPublishedCandidates(input: {
    categoryId?: string | undefined;
    excludeProductId?: string | undefined;
    limit: number;
  }): Promise<AiCatalogCandidate[]> {
    const conditions: SQL[] = [eq(product.status, ProductStatus.PUBLISHED), isNull(product.deletedAt)];
    if (input.categoryId !== undefined) conditions.push(eq(product.categoryId, input.categoryId));
    if (input.excludeProductId !== undefined) conditions.push(ne(product.id, input.excludeProductId));
    const rows = await this.db
      .select({
        productId: product.id,
        title: product.title,
        categoryId: product.categoryId,
        categoryName: category.name,
        brandName: brand.name,
      })
      .from(product)
      .innerJoin(category, eq(product.categoryId, category.id))
      .leftJoin(brand, eq(product.brandId, brand.id))
      .where(and(...conditions))
      .orderBy(desc(product.publishedAt))
      .limit(input.limit);
    return rows.map((row) => ({
      productId: row.productId,
      title: row.title,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      brandName: row.brandName,
      attributes: {},
    }));
  }

  public async getPricingContexts(input: {
    variantId?: string | undefined;
    categoryId?: string | undefined;
    limit: number;
  }): Promise<AiPricingContext[]> {
    const now = new Date();
    const variantConditions: SQL[] = [eq(productVariant.isActive, true), isNull(product.deletedAt)];
    if (input.variantId !== undefined) variantConditions.push(eq(productVariant.id, input.variantId));
    if (input.categoryId !== undefined) variantConditions.push(eq(product.categoryId, input.categoryId));
    const variants = await this.db
      .select({
        variantId: productVariant.id,
        productTitle: product.title,
        categoryId: product.categoryId,
        categoryName: category.name,
      })
      .from(productVariant)
      .innerJoin(product, eq(productVariant.productId, product.id))
      .innerJoin(category, eq(product.categoryId, category.id))
      .where(and(...variantConditions))
      .limit(input.limit);
    if (variants.length === 0) {
      return [];
    }
    const variantIds = variants.map((variant) => variant.variantId);

    const costs = await this.db
      .select({
        variantId: supplierCost.variantId,
        costAmountMinor: supplierCost.costAmountMinor,
      })
      .from(supplierCost)
      .where(
        and(
          inArray(supplierCost.variantId, variantIds),
          lte(supplierCost.validFrom, now),
          or(isNull(supplierCost.validTo), sql`${supplierCost.validTo} > ${now}`),
        ),
      )
      .orderBy(desc(supplierCost.validFrom));
    const costByVariant = new Map<string, number>();
    for (const cost of costs) {
      if (!costByVariant.has(cost.variantId)) {
        costByVariant.set(cost.variantId, cost.costAmountMinor);
      }
    }

    const prices = await this.db
      .select({ variantId: price.variantId, amountMinor: price.amountMinor })
      .from(price)
      .where(
        and(
          inArray(price.variantId, variantIds),
          lte(price.validFrom, now),
          or(isNull(price.validTo), sql`${price.validTo} > ${now}`),
        ),
      )
      .orderBy(desc(price.validFrom));
    const priceByVariant = new Map<string, number>();
    for (const row of prices) {
      if (!priceByVariant.has(row.variantId)) {
        priceByVariant.set(row.variantId, row.amountMinor);
      }
    }

    const categoryIds = [...new Set(variants.map((variant) => variant.categoryId))];
    const rules = await this.db
      .select({ scope: markupRule.scope, scopeId: markupRule.scopeId, minMarginBps: markupRule.minMarginBps })
      .from(markupRule)
      .where(and(eq(markupRule.isActive, true), or(isNull(markupRule.scopeId), inArray(markupRule.scopeId, categoryIds)) ?? sql`false`))
      .orderBy(desc(markupRule.createdAt));
    const minMarginForCategory = (categoryId: string): number | null => {
      const scoped = rules.find((rule) => rule.scopeId === categoryId);
      if (scoped?.minMarginBps != null) return scoped.minMarginBps;
      const global = rules.find((rule) => rule.scopeId === null);
      return global?.minMarginBps ?? null;
    };

    return variants
      .filter((variant) => costByVariant.has(variant.variantId))
      .map((variant) => ({
        variantId: variant.variantId,
        productTitle: variant.productTitle,
        categoryName: variant.categoryName,
        currentPriceMinor: priceByVariant.get(variant.variantId) ?? null,
        supplierCostMinor: costByVariant.get(variant.variantId) ?? 0,
        currency: "ARS" as const,
        minMarginBps: minMarginForCategory(variant.categoryId),
      }));
  }

  public async getFallbackRecommendations(input: {
    seedProductId?: string | undefined;
    categoryId?: string | undefined;
    limit: number;
  }): Promise<AiRecommendation[]> {
    let categoryId = input.categoryId;
    if (!categoryId && input.seedProductId) {
      const seed = await this.db.query.product.findFirst({ where: eq(product.id, input.seedProductId) });
      categoryId = seed?.categoryId;
    }
    const candidates = await this.listPublishedCandidates({
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(input.seedProductId !== undefined ? { excludeProductId: input.seedProductId } : {}),
      limit: input.limit,
    });
    return candidates.map((candidate, index) => ({
      productId: candidate.productId,
      score: Math.max(0.1, 0.9 - index * 0.1),
      reasonCodes: categoryId ? ["same_category", "recently_published"] : ["recently_published"],
      evidence: { matchedAttributes: [], basedOn: ["fallback_precomputed"] },
    }));
  }
}

const sanitizeAttributes = (attributes: Record<string, unknown>): Record<string, string | number | boolean | null> => {
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      continue;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    }
  }
  return sanitized;
};
