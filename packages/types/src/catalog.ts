import type { Currency, Money } from "./domain.js";
import type { MediaSource, ProductStatus, StockStatus } from "./enums.js";

export type SeoFields = {
  seoTitle: string | null;
  seoDescription: string | null;
};

export type MediaAssetResponse = {
  id: string;
  mime: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  dominantColor: string | null;
  blurPlaceholder: string | null;
  altText: string | null;
  source: MediaSource;
  checksum: string;
  signedUrl?: string;
  createdAt: string;
};

export type CategoryNode = SeoFields & {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  imageId: string | null;
  position: number;
  isActive: boolean;
  children: CategoryNode[];
  createdAt: string;
  updatedAt: string;
};

export type BrandResponse = {
  id: string;
  name: string;
  slug: string;
  logoId: string | null;
  isActive: boolean;
};

export type ProductVariantResponse = {
  id: string;
  productId: string;
  sku: string;
  title: string;
  isActive: boolean;
  attributes: Record<string, string | number | boolean | null>;
  position: number;
};

export type SpecItemResponse = {
  id: string;
  key: string;
  label: string;
  valueText: string | null;
  valueNum: number | null;
  unit: string | null;
  position: number;
};

export type SpecGroupResponse = {
  id: string;
  name: string;
  position: number;
  items: SpecItemResponse[];
};

export type ProductMediaResponse = {
  id: string;
  productId: string;
  mediaAssetId: string;
  position: number;
  altText: string | null;
  asset: MediaAssetResponse | null;
};

/** Precio mayorista visible en la tienda a partir de `minQuantity` unidades. */
export type WholesaleTier = {
  minQuantity: number;
  price: Money;
};

export type ProductCard = SeoFields & {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  brand: BrandResponse | null;
  category: Pick<CategoryNode, "id" | "name" | "slug"> | null;
  mainImage: MediaAssetResponse | null;
  price: Money | null;
  compareAtPrice: Money | null;
  wholesale: WholesaleTier | null;
  currency: Currency;
  stockStatus: StockStatus;
  status: ProductStatus;
  sku: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductAdminDetail = ProductCard & {
  description: string;
  publishedAt: string | null;
  variants: ProductVariantResponse[];
  specs: SpecGroupResponse[];
  media: ProductMediaResponse[];
};

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type PublishChecklistItem = {
  key: string;
  label: string;
  passed: boolean;
  phase: "phase-2" | "phase-3";
  blocking: boolean;
};
