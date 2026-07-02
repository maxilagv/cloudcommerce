import { category, mediaAsset, product, productVariant } from "@cloudcommerce/database";
import { ProductStatus } from "@cloudcommerce/types";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { DashboardCatalogPort, VariantCatalogInfo } from "../../application/ports.js";

export class DashboardCatalogReadModel implements DashboardCatalogPort {
  public constructor(private readonly db: Database) {}

  public async countPublishedProducts(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(product)
      .where(and(eq(product.status, ProductStatus.PUBLISHED), isNull(product.deletedAt)));
    return row?.count ?? 0;
  }

  public async getVariantInfo(variantIds: string[]): Promise<VariantCatalogInfo[]> {
    if (variantIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({
        variantId: productVariant.id,
        productId: product.id,
        productTitle: product.title,
        sku: productVariant.sku,
        categoryId: category.id,
        categoryName: category.name,
        imageStorageKey: mediaAsset.storageKey,
      })
      .from(productVariant)
      .innerJoin(product, eq(productVariant.productId, product.id))
      .innerJoin(category, eq(product.categoryId, category.id))
      .leftJoin(mediaAsset, eq(product.mainImageId, mediaAsset.id))
      .where(inArray(productVariant.id, variantIds));
    return rows.map((row) => {
      const base = {
        variantId: row.variantId,
        productId: row.productId,
        productTitle: row.productTitle,
        sku: row.sku,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
      };
      return row.imageStorageKey ? { ...base, imageUrl: `/media/${row.imageStorageKey}` } : base;
    });
  }
}
