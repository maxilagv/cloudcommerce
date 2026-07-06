/**
 * UI shapes for the product detail page (PDP). Instances are produced
 * exclusively from real backend data by `lib/api/catalog.ts` (`mapDetailToUi`).
 */

import type { ProductCardData } from "./catalog-types";

export type ColorVariant = { id: string; label: string; hex: string };
export type CapacityVariant = { id: string; label: string };
export type SpecRow = { label: string; value: string };
export type SpecSection = { category: string; rows: SpecRow[] };

export type Review = {
  author: string;
  initials: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  helpful: number;
};

export type ProductDetailData = ProductCardData & {
  slug: string;
  images: string[];
  colorVariants: ColorVariant[];
  capacityVariants: CapacityVariant[];
  activeColor: string;
  activeCapacity: string;
  specs: SpecSection[];
  longDescription: string;
  descriptionBullets: string[];
  services: { icon: string; title: string; body: string }[];
  reviews: Review[];
  reviewDistribution: { stars: number; count: number }[];
  questions: { question: string; answer: string; date: string }[];
  breadcrumb: { label: string; href?: string }[];
};
