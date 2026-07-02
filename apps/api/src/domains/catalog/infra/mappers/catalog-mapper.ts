import {
  brand,
  category,
  mediaAsset,
  product,
  productMedia,
  productVariant,
  specGroup,
  specItem,
} from "@cloudcommerce/database";
import type { InferSelectModel } from "drizzle-orm";
import type {
  BrandEntity,
  CategoryEntity,
  MediaAssetEntity,
  ProductEntity,
  ProductMediaEntity,
  ProductVariantEntity,
  SpecGroupEntity,
  SpecItemEntity,
} from "../../domain/entities/catalog-entities.js";

type CategoryRow = InferSelectModel<typeof category>;
type BrandRow = InferSelectModel<typeof brand>;
type ProductRow = InferSelectModel<typeof product>;
type ProductVariantRow = InferSelectModel<typeof productVariant>;
type ProductMediaRow = InferSelectModel<typeof productMedia>;
type MediaAssetRow = InferSelectModel<typeof mediaAsset>;
type SpecGroupRow = InferSelectModel<typeof specGroup>;
type SpecItemRow = InferSelectModel<typeof specItem>;

export const mapCategory = (row: CategoryRow): CategoryEntity => ({
  id: row.id,
  parentId: row.parentId,
  name: row.name,
  slug: row.slug,
  description: row.description,
  imageId: row.imageId,
  position: row.position,
  isActive: row.isActive,
  seoTitle: row.seoTitle,
  seoDescription: row.seoDescription,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const mapBrand = (row: BrandRow): BrandEntity => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  logoId: row.logoId,
  isActive: row.isActive,
});

export const mapMediaAsset = (row: MediaAssetRow): MediaAssetEntity => ({
  id: row.id,
  storageKey: row.storageKey,
  mime: row.mime,
  byteSize: row.byteSize,
  width: row.width,
  height: row.height,
  dominantColor: row.dominantColor,
  blurPlaceholder: row.blurPlaceholder,
  altText: row.altText,
  source: row.source,
  checksum: row.checksum,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

export const mapProduct = (row: ProductRow): ProductEntity => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  subtitle: row.subtitle,
  description: row.description,
  brandId: row.brandId,
  categoryId: row.categoryId,
  status: row.status,
  mainImageId: row.mainImageId,
  sku: row.sku,
  seoTitle: row.seoTitle,
  seoDescription: row.seoDescription,
  publishedAt: row.publishedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  deletedAt: row.deletedAt,
});

export const mapProductVariant = (row: ProductVariantRow): ProductVariantEntity => ({
  id: row.id,
  productId: row.productId,
  sku: row.sku,
  title: row.title,
  isActive: row.isActive,
  attributes: isRecord(row.attributes) ? row.attributes : {},
  position: row.position,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const mapProductMedia = (row: ProductMediaRow, asset: MediaAssetRow | null): ProductMediaEntity => ({
  id: row.id,
  productId: row.productId,
  mediaAssetId: row.mediaAssetId,
  position: row.position,
  altText: row.altText,
  asset: asset ? mapMediaAsset(asset) : null,
});

export const mapSpecItem = (row: SpecItemRow): SpecItemEntity => ({
  id: row.id,
  specGroupId: row.specGroupId,
  key: row.key,
  label: row.label,
  valueText: row.valueText,
  valueNum: row.valueNum === null ? null : Number(row.valueNum),
  unit: row.unit,
  position: row.position,
});

export const mapSpecGroup = (row: SpecGroupRow, items: SpecItemRow[]): SpecGroupEntity => ({
  id: row.id,
  productId: row.productId,
  name: row.name,
  position: row.position,
  items: items.map(mapSpecItem).sort((left, right) => left.position - right.position),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
