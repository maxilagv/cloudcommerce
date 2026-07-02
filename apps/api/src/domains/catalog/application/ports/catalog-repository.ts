import type { ProductStatus, StockStatus } from "@cloudcommerce/types";
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

export type CreateCategoryRecord = Omit<CategoryEntity, "createdAt" | "updatedAt">;
export type UpdateCategoryRecord = Partial<Omit<CreateCategoryRecord, "id">> & { id: string };

export type CreateBrandRecord = BrandEntity;
export type UpdateBrandRecord = Partial<Omit<BrandEntity, "id">> & { id: string };

export type CreateProductRecord = Omit<ProductEntity, "createdAt" | "updatedAt" | "deletedAt" | "publishedAt" | "status"> & {
  status: ProductStatus;
};
export type UpdateProductRecord = Partial<Omit<CreateProductRecord, "id">> & {
  id: string;
  status?: ProductStatus;
  publishedAt?: Date | null;
  deletedAt?: Date | null;
};

export type CreateVariantRecord = Omit<ProductVariantEntity, "createdAt" | "updatedAt">;
export type UpdateVariantRecord = Partial<Omit<CreateVariantRecord, "id">> & { id: string };

export type ReplaceSpecGroupRecord = {
  id: string;
  productId: string;
  name: string;
  position: number;
  items: Array<{
    id: string;
    key: string;
    label: string;
    valueText: string | null;
    valueNum: number | null;
    unit: string | null;
    position: number;
  }>;
};

export type ReplaceProductMediaRecord = {
  productId: string;
  mainImageId: string;
  media: Array<{
    id: string;
    mediaAssetId: string;
    position: number;
    altText: string | null;
  }>;
};

export type ProductSearchFilters = {
  query?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  limit: number;
  cursor?: string;
  sort: "created_desc" | "created_asc" | "title_asc" | "updated_desc";
};

export type ProductSearchResult = {
  items: ProductAggregate[];
  nextCursor: string | null;
};

export interface CatalogRepository {
  listCategories(includeInactive: boolean): Promise<CategoryEntity[]>;
  findCategoryById(id: string): Promise<CategoryEntity | null>;
  findCategoryByParentAndSlug(parentId: string | null, slug: string): Promise<CategoryEntity | null>;
  createCategory(input: CreateCategoryRecord): Promise<CategoryEntity>;
  updateCategory(input: UpdateCategoryRecord): Promise<CategoryEntity | null>;

  listBrands(includeInactive: boolean): Promise<BrandEntity[]>;
  findBrandById(id: string): Promise<BrandEntity | null>;
  findBrandBySlug(slug: string): Promise<BrandEntity | null>;
  createBrand(input: CreateBrandRecord): Promise<BrandEntity>;
  updateBrand(input: UpdateBrandRecord): Promise<BrandEntity | null>;

  findMediaAssetById(id: string): Promise<MediaAssetEntity | null>;
  findProductById(id: string): Promise<ProductEntity | null>;
  findProductBySlug(slug: string): Promise<ProductAggregate | null>;
  getProductAggregate(id: string): Promise<ProductAggregate | null>;
  searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult>;
  createProduct(input: CreateProductRecord): Promise<ProductEntity>;
  updateProduct(input: UpdateProductRecord, previousSlug?: string): Promise<ProductEntity | null>;
  archiveProduct(id: string, archivedAt: Date): Promise<ProductEntity | null>;

  createVariant(input: CreateVariantRecord): Promise<ProductVariantEntity>;
  updateVariant(input: UpdateVariantRecord): Promise<ProductVariantEntity | null>;
  deleteVariant(id: string): Promise<void>;

  replaceSpecs(productId: string, groups: ReplaceSpecGroupRecord[]): Promise<SpecGroupEntity[]>;
  replaceProductMedia(input: ReplaceProductMediaRecord): Promise<ProductMediaEntity[]>;

  enqueueOutbox(event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void>;
}

export interface PriceReaderPort {
  getProductPrice(productId: string): Promise<{ salePriceMinor: number; compareAtPriceMinor: number | null; currency: "ARS" } | null>;
}

export interface StockReaderPort {
  getProductStockStatus(productId: string): Promise<StockStatus>;
}
