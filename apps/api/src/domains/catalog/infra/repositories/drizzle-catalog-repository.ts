import {
  brand,
  category,
  mediaAsset,
  outboxEvent,
  product,
  productMedia,
  productSlugHistory,
  productVariant,
  specGroup,
  specItem,
} from "@cloudcommerce/database";
import { ProductStatus } from "@cloudcommerce/types";
import { and, asc, desc, eq, gt, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  BrandEntity,
  CategoryEntity,
  MediaAssetEntity,
  ProductAggregate,
  ProductEntity,
  ProductMediaEntity,
  ProductVariantEntity,
  SpecGroupEntity,
} from "../../domain/entities/catalog-entities.js";
import type {
  CatalogRepository,
  CreateBrandRecord,
  CreateCategoryRecord,
  CreateProductRecord,
  CreateVariantRecord,
  ProductSearchFilters,
  ProductSearchResult,
  ReplaceProductMediaRecord,
  ReplaceSpecGroupRecord,
  UpdateBrandRecord,
  UpdateCategoryRecord,
  UpdateProductRecord,
  UpdateVariantRecord,
} from "../../application/ports/catalog-repository.js";
import {
  mapBrand,
  mapCategory,
  mapMediaAsset,
  mapProduct,
  mapProductMedia,
  mapProductVariant,
  mapSpecGroup,
} from "../mappers/catalog-mapper.js";

type ProductCursor = {
  value: string;
  id: string;
};

export class DrizzleCatalogRepository implements CatalogRepository {
  public constructor(private readonly db: Database) {}

  public async listCategories(includeInactive: boolean): Promise<CategoryEntity[]> {
    const rows = includeInactive
      ? await this.db.select().from(category).orderBy(asc(category.parentId), asc(category.position), asc(category.name))
      : await this.db
          .select()
          .from(category)
          .where(eq(category.isActive, true))
          .orderBy(asc(category.parentId), asc(category.position), asc(category.name));
    return rows.map(mapCategory);
  }

  public async findCategoryById(id: string): Promise<CategoryEntity | null> {
    const row = await this.db.query.category.findFirst({ where: eq(category.id, id) });
    return row ? mapCategory(row) : null;
  }

  public async findCategoryByParentAndSlug(parentId: string | null, slug: string): Promise<CategoryEntity | null> {
    const row = await this.db.query.category.findFirst({
      where: parentId === null ? and(isNull(category.parentId), eq(category.slug, slug)) : and(eq(category.parentId, parentId), eq(category.slug, slug)),
    });
    return row ? mapCategory(row) : null;
  }

  public async createCategory(input: CreateCategoryRecord): Promise<CategoryEntity> {
    const [row] = await this.db.insert(category).values(input).returning();
    if (!row) {
      throw new Error("Failed to create category");
    }
    return mapCategory(row);
  }

  public async updateCategory(input: UpdateCategoryRecord): Promise<CategoryEntity | null> {
    const set: Partial<typeof category.$inferInsert> = { updatedAt: new Date() };
    if ("parentId" in input) set.parentId = input.parentId;
    if ("name" in input) set.name = input.name;
    if ("slug" in input) set.slug = input.slug;
    if ("description" in input) set.description = input.description;
    if ("imageId" in input) set.imageId = input.imageId;
    if ("position" in input) set.position = input.position;
    if ("isActive" in input) set.isActive = input.isActive;
    if ("seoTitle" in input) set.seoTitle = input.seoTitle;
    if ("seoDescription" in input) set.seoDescription = input.seoDescription;
    const [row] = await this.db.update(category).set(set).where(eq(category.id, input.id)).returning();
    return row ? mapCategory(row) : null;
  }

  public async listBrands(includeInactive: boolean): Promise<BrandEntity[]> {
    const rows = includeInactive
      ? await this.db.select().from(brand).orderBy(asc(brand.name))
      : await this.db.select().from(brand).where(eq(brand.isActive, true)).orderBy(asc(brand.name));
    return rows.map(mapBrand);
  }

  public async findBrandById(id: string): Promise<BrandEntity | null> {
    const row = await this.db.query.brand.findFirst({ where: eq(brand.id, id) });
    return row ? mapBrand(row) : null;
  }

  public async findBrandBySlug(slug: string): Promise<BrandEntity | null> {
    const row = await this.db.query.brand.findFirst({ where: eq(brand.slug, slug) });
    return row ? mapBrand(row) : null;
  }

  public async createBrand(input: CreateBrandRecord): Promise<BrandEntity> {
    const [row] = await this.db.insert(brand).values(input).returning();
    if (!row) {
      throw new Error("Failed to create brand");
    }
    return mapBrand(row);
  }

  public async updateBrand(input: UpdateBrandRecord): Promise<BrandEntity | null> {
    const set: Partial<typeof brand.$inferInsert> = {};
    if ("name" in input) set.name = input.name;
    if ("slug" in input) set.slug = input.slug;
    if ("logoId" in input) set.logoId = input.logoId;
    if ("isActive" in input) set.isActive = input.isActive;
    const [row] = await this.db.update(brand).set(set).where(eq(brand.id, input.id)).returning();
    return row ? mapBrand(row) : null;
  }

  public async findMediaAssetById(id: string): Promise<MediaAssetEntity | null> {
    const row = await this.db.query.mediaAsset.findFirst({ where: eq(mediaAsset.id, id) });
    return row ? mapMediaAsset(row) : null;
  }

  public async findProductById(id: string): Promise<ProductEntity | null> {
    const row = await this.db.query.product.findFirst({ where: and(eq(product.id, id), isNull(product.deletedAt)) });
    return row ? mapProduct(row) : null;
  }

  public async findProductBySlug(slug: string): Promise<ProductAggregate | null> {
    const row = await this.db.query.product.findFirst({ where: and(eq(product.slug, slug), isNull(product.deletedAt)) });
    return row ? this.getProductAggregate(row.id) : null;
  }

  public async findPublishedProductBySlug(slug: string): Promise<ProductAggregate | null> {
    const row = await this.db.query.product.findFirst({
      where: and(eq(product.slug, slug), eq(product.status, ProductStatus.PUBLISHED), isNull(product.deletedAt)),
    });
    return row ? this.getProductAggregate(row.id) : null;
  }

  public async getProductAggregate(id: string): Promise<ProductAggregate | null> {
    const row = await this.db.query.product.findFirst({ where: and(eq(product.id, id), isNull(product.deletedAt)) });
    if (!row) {
      return null;
    }

    const [categoryRow, brandRow, mainImageRow, variantRows, mediaRows, specGroupRows] = await Promise.all([
      this.db.query.category.findFirst({ where: eq(category.id, row.categoryId) }),
      row.brandId ? this.db.query.brand.findFirst({ where: eq(brand.id, row.brandId) }) : Promise.resolve(undefined),
      row.mainImageId ? this.db.query.mediaAsset.findFirst({ where: eq(mediaAsset.id, row.mainImageId) }) : Promise.resolve(undefined),
      this.db.select().from(productVariant).where(eq(productVariant.productId, row.id)).orderBy(asc(productVariant.position)),
      this.db.select().from(productMedia).where(eq(productMedia.productId, row.id)).orderBy(asc(productMedia.position)),
      this.db.select().from(specGroup).where(eq(specGroup.productId, row.id)).orderBy(asc(specGroup.position)),
    ]);

    const assetIds = mediaRows.map((media) => media.mediaAssetId);
    const assetRows =
      assetIds.length > 0 ? await this.db.select().from(mediaAsset).where(inArray(mediaAsset.id, assetIds)) : [];
    const assetById = new Map(assetRows.map((asset) => [asset.id, asset]));

    const groupIds = specGroupRows.map((group) => group.id);
    const itemRows = groupIds.length > 0 ? await this.db.select().from(specItem).where(inArray(specItem.specGroupId, groupIds)) : [];
    const itemsByGroup = new Map<string, typeof itemRows>();
    for (const item of itemRows) {
      const current = itemsByGroup.get(item.specGroupId) ?? [];
      current.push(item);
      itemsByGroup.set(item.specGroupId, current);
    }

    return {
      product: mapProduct(row),
      category: categoryRow ? mapCategory(categoryRow) : null,
      brand: brandRow ? mapBrand(brandRow) : null,
      mainImage: mainImageRow ? mapMediaAsset(mainImageRow) : null,
      variants: variantRows.map(mapProductVariant),
      media: mediaRows.map((media) => mapProductMedia(media, assetById.get(media.mediaAssetId) ?? null)),
      specs: specGroupRows.map((group) => mapSpecGroup(group, itemsByGroup.get(group.id) ?? [])),
    };
  }

  public async searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult> {
    const where = this.buildProductSearchWhere(filters);
    const rows = await this.db
      .select()
      .from(product)
      .where(where)
      .orderBy(...this.orderBy(filters.sort))
      .limit(filters.limit + 1);
    const visibleRows = rows.slice(0, filters.limit);
    const aggregates = await Promise.all(visibleRows.map((row) => this.getProductAggregate(row.id)));
    const items = aggregates.filter((item): item is ProductAggregate => item !== null);
    const last = rows.length > filters.limit ? visibleRows.at(-1) : undefined;
    return {
      items,
      nextCursor: last ? this.encodeCursor(filters.sort, last) : null,
    };
  }

  public async createProduct(input: CreateProductRecord): Promise<ProductEntity> {
    const [row] = await this.db.insert(product).values(input).returning();
    if (!row) {
      throw new Error("Failed to create product");
    }
    return mapProduct(row);
  }

  public async updateProduct(input: UpdateProductRecord, previousSlug?: string): Promise<ProductEntity | null> {
    if (previousSlug) {
      await this.db.insert(productSlugHistory).values({
        id: uuidv7(),
        productId: input.id,
        oldSlug: previousSlug,
      });
    }
    const set: Partial<typeof product.$inferInsert> = { updatedAt: new Date() };
    if ("slug" in input) set.slug = input.slug;
    if ("title" in input) set.title = input.title;
    if ("subtitle" in input) set.subtitle = input.subtitle;
    if ("description" in input) set.description = input.description;
    if ("brandId" in input) set.brandId = input.brandId;
    if ("categoryId" in input) set.categoryId = input.categoryId;
    if ("status" in input) set.status = input.status;
    if ("mainImageId" in input) set.mainImageId = input.mainImageId;
    if ("sku" in input) set.sku = input.sku;
    if ("seoTitle" in input) set.seoTitle = input.seoTitle;
    if ("seoDescription" in input) set.seoDescription = input.seoDescription;
    if ("publishedAt" in input) set.publishedAt = input.publishedAt;
    if ("deletedAt" in input) set.deletedAt = input.deletedAt;
    const [row] = await this.db.update(product).set(set).where(and(eq(product.id, input.id), isNull(product.deletedAt))).returning();
    return row ? mapProduct(row) : null;
  }

  public async archiveProduct(id: string, archivedAt: Date): Promise<ProductEntity | null> {
    const [row] = await this.db
      .update(product)
      .set({ status: ProductStatus.ARCHIVED, updatedAt: archivedAt })
      .where(and(eq(product.id, id), isNull(product.deletedAt)))
      .returning();
    return row ? mapProduct(row) : null;
  }

  public async createVariant(input: CreateVariantRecord): Promise<ProductVariantEntity> {
    const [row] = await this.db.insert(productVariant).values(input).returning();
    if (!row) {
      throw new Error("Failed to create variant");
    }
    return mapProductVariant(row);
  }

  public async updateVariant(input: UpdateVariantRecord): Promise<ProductVariantEntity | null> {
    const set: Partial<typeof productVariant.$inferInsert> = { updatedAt: new Date() };
    if ("productId" in input) set.productId = input.productId;
    if ("sku" in input) set.sku = input.sku;
    if ("title" in input) set.title = input.title;
    if ("isActive" in input) set.isActive = input.isActive;
    if ("attributes" in input) set.attributes = input.attributes;
    if ("position" in input) set.position = input.position;
    const [row] = await this.db.update(productVariant).set(set).where(eq(productVariant.id, input.id)).returning();
    return row ? mapProductVariant(row) : null;
  }

  public async deleteVariant(id: string): Promise<void> {
    await this.db.delete(productVariant).where(eq(productVariant.id, id));
  }

  public async replaceSpecs(productId: string, groups: ReplaceSpecGroupRecord[]): Promise<SpecGroupEntity[]> {
    await this.db.delete(specGroup).where(eq(specGroup.productId, productId));
    if (groups.length === 0) {
      return [];
    }
    await this.db.insert(specGroup).values(groups.map(({ items: _items, ...group }) => group));
    const itemValues = groups.flatMap((group) =>
      group.items.map((item) => ({
        id: item.id,
        specGroupId: group.id,
        key: item.key,
        label: item.label,
        valueText: item.valueText,
        valueNum: item.valueNum === null ? null : String(item.valueNum),
        unit: item.unit,
        position: item.position,
      })),
    );
    if (itemValues.length > 0) {
      await this.db.insert(specItem).values(itemValues);
    }
    const aggregate = await this.getProductAggregate(productId);
    return aggregate?.specs ?? [];
  }

  public async replaceProductMedia(input: ReplaceProductMediaRecord): Promise<ProductMediaEntity[]> {
    await this.db.delete(productMedia).where(eq(productMedia.productId, input.productId));
    if (input.media.length > 0) {
      await this.db.insert(productMedia).values(input.media.map((item) => ({ ...item, productId: input.productId })));
    }
    await this.db.update(product).set({ mainImageId: input.mainImageId, updatedAt: new Date() }).where(eq(product.id, input.productId));
    const aggregate = await this.getProductAggregate(input.productId);
    return aggregate?.media ?? [];
  }

  public async enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(outboxEvent).values(event);
  }

  private buildProductSearchWhere(filters: ProductSearchFilters) {
    const conditions = [isNull(product.deletedAt)];
    if (filters.query) {
      conditions.push(ilike(product.title, `%${filters.query}%`));
    }
    if (filters.categoryId) {
      conditions.push(eq(product.categoryId, filters.categoryId));
    }
    if (filters.brandId) {
      conditions.push(eq(product.brandId, filters.brandId));
    }
    if (filters.status) {
      conditions.push(eq(product.status, filters.status));
    }

    const cursor = filters.cursor ? this.decodeCursor(filters.cursor) : null;
    if (cursor) {
      const cursorCondition = this.cursorWhere(filters.sort, cursor);
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    return and(...conditions);
  }

  private orderBy(sort: ProductSearchFilters["sort"]) {
    switch (sort) {
      case "created_asc":
        return [asc(product.createdAt), asc(product.id)] as const;
      case "title_asc":
        return [asc(product.title), asc(product.id)] as const;
      case "updated_desc":
        return [desc(product.updatedAt), desc(product.id)] as const;
      case "created_desc":
        return [desc(product.createdAt), desc(product.id)] as const;
    }
  }

  private cursorWhere(sort: ProductSearchFilters["sort"], cursor: ProductCursor) {
    switch (sort) {
      case "created_asc":
        return or(gt(product.createdAt, new Date(cursor.value)), and(eq(product.createdAt, new Date(cursor.value)), gt(product.id, cursor.id)));
      case "title_asc":
        return or(gt(product.title, cursor.value), and(eq(product.title, cursor.value), gt(product.id, cursor.id)));
      case "updated_desc":
        return or(lt(product.updatedAt, new Date(cursor.value)), and(eq(product.updatedAt, new Date(cursor.value)), lt(product.id, cursor.id)));
      case "created_desc":
        return or(lt(product.createdAt, new Date(cursor.value)), and(eq(product.createdAt, new Date(cursor.value)), lt(product.id, cursor.id)));
    }
  }

  private encodeCursor(sort: ProductSearchFilters["sort"], row: typeof product.$inferSelect): string {
    const value =
      sort === "title_asc"
        ? row.title
        : sort === "updated_desc"
          ? row.updatedAt.toISOString()
          : row.createdAt.toISOString();
    return Buffer.from(JSON.stringify({ value, id: row.id }), "utf8").toString("base64url");
  }

  private decodeCursor(cursor: string): ProductCursor | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
      if (isProductCursor(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}

const isProductCursor = (value: unknown): value is ProductCursor =>
  value !== null &&
  typeof value === "object" &&
  "value" in value &&
  "id" in value &&
  typeof value.value === "string" &&
  typeof value.id === "string";
