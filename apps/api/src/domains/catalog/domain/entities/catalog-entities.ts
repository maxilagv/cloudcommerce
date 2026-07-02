import type { MediaSource, ProductStatus } from "@cloudcommerce/types";

export type CategoryEntity = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageId: string | null;
  position: number;
  isActive: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BrandEntity = {
  id: string;
  name: string;
  slug: string;
  logoId: string | null;
  isActive: boolean;
};

export type MediaAssetEntity = {
  id: string;
  storageKey: string;
  mime: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  blurPlaceholder: string | null;
  altText: string | null;
  source: MediaSource;
  checksum: string;
  createdBy: string | null;
  createdAt: Date;
};

export type ProductEntity = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  brandId: string | null;
  categoryId: string;
  status: ProductStatus;
  mainImageId: string | null;
  sku: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ProductVariantEntity = {
  id: string;
  productId: string;
  sku: string;
  title: string;
  isActive: boolean;
  attributes: Record<string, unknown>;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductMediaEntity = {
  id: string;
  productId: string;
  mediaAssetId: string;
  position: number;
  altText: string | null;
  asset: MediaAssetEntity | null;
};

export type SpecItemEntity = {
  id: string;
  specGroupId: string;
  key: string;
  label: string;
  valueText: string | null;
  valueNum: number | null;
  unit: string | null;
  position: number;
};

export type SpecGroupEntity = {
  id: string;
  productId: string;
  name: string;
  position: number;
  items: SpecItemEntity[];
};

export type ProductAggregate = {
  product: ProductEntity;
  category: CategoryEntity | null;
  brand: BrandEntity | null;
  mainImage: MediaAssetEntity | null;
  media: ProductMediaEntity[];
  variants: ProductVariantEntity[];
  specs: SpecGroupEntity[];
};
