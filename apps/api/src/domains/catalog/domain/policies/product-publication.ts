import { ProductStatus, StockStatus, type PublishChecklistItem } from "@cloudcommerce/types";
import type { ProductAggregate } from "../entities/catalog-entities.js";

const terminalStatuses = new Set<ProductStatus>([ProductStatus.ARCHIVED]);

export const allowedProductStatusTransitions: Record<ProductStatus, ProductStatus[]> = {
  [ProductStatus.DRAFT]: [ProductStatus.READY_FOR_REVIEW, ProductStatus.ARCHIVED],
  [ProductStatus.READY_FOR_REVIEW]: [ProductStatus.DRAFT, ProductStatus.PUBLISHED, ProductStatus.ARCHIVED],
  [ProductStatus.PUBLISHED]: [ProductStatus.PAUSED, ProductStatus.ARCHIVED],
  [ProductStatus.PAUSED]: [ProductStatus.PUBLISHED, ProductStatus.ARCHIVED],
  [ProductStatus.ARCHIVED]: [],
};

export const canTransitionProductStatus = (from: ProductStatus, to: ProductStatus): boolean =>
  from === to || allowedProductStatusTransitions[from].includes(to);

export type PublicationPortState = {
  hasPrice: boolean;
  stockStatus: StockStatus;
};

export const buildPublicationChecklist = (
  aggregate: ProductAggregate,
  ports: PublicationPortState,
): PublishChecklistItem[] => {
  const product = aggregate.product;
  const activeVariantCount = aggregate.variants.filter((variant) => variant.isActive).length;
  const specItemCount = aggregate.specs.reduce((count, group) => count + group.items.length, 0);
  const hasMainImageInGallery =
    product.mainImageId !== null && aggregate.media.some((item) => item.mediaAssetId === product.mainImageId);

  return [
    {
      key: "title",
      label: "Titulo",
      passed: product.title.trim().length > 0,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "slug",
      label: "Slug",
      passed: product.slug.trim().length > 0,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "brand",
      label: "Marca",
      passed: aggregate.brand !== null && aggregate.brand.isActive,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "category",
      label: "Categoria activa",
      passed: aggregate.category !== null && aggregate.category.isActive,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "description",
      label: "Descripcion",
      passed: product.description.trim().length >= 40,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "main_image",
      label: "Imagen principal",
      passed: hasMainImageInGallery,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "variants",
      label: "Variante activa",
      passed: activeVariantCount >= 1,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "specs",
      label: "Especificaciones minimas",
      passed: specItemCount >= 3,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "seo",
      label: "SEO minimo",
      passed:
        product.seoTitle !== null &&
        product.seoTitle.trim().length >= 10 &&
        product.seoDescription !== null &&
        product.seoDescription.trim().length >= 30,
      phase: "phase-2",
      blocking: true,
    },
    {
      key: "price",
      label: "Precio vigente",
      passed: ports.hasPrice,
      phase: "phase-3",
      blocking: true,
    },
    {
      key: "stock",
      label: "Stock vendible",
      passed: ports.stockStatus !== StockStatus.OUT_OF_STOCK,
      phase: "phase-3",
      blocking: true,
    },
  ];
};

export const publicationBlockingFailures = (items: PublishChecklistItem[]): PublishChecklistItem[] =>
  items.filter((item) => item.blocking && !item.passed);

export const isTerminalStatus = (status: ProductStatus): boolean => terminalStatuses.has(status);
