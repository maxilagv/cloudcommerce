/**
 * Pure catalog filtering + sorting engine. No React, no stores — so it can be
 * reused by the catalog store AND the /search results, and unit-tested in
 * isolation. It refines the product list already fetched from the backend
 * (category/text narrowing happens server-side via `store.products.list`).
 */

import type { ProductCardData } from "./catalog-types";

export type SortKey = "relevance" | "price-asc" | "price-desc" | "newest";

export type CatalogQuery = {
  query: string;
  category: string | null;
  brands: string[];
  availability: string[];
  priceMax: number;
  sort: SortKey;
  page: number;
};

export const PAGE_SIZE = 8;

export const defaultCatalogQuery: CatalogQuery = {
  query: "",
  category: null,
  brands: [],
  availability: [],
  // "No price cap": real catalog bounds are computed per product list.
  priceMax: Number.MAX_SAFE_INTEGER,
  sort: "relevance",
  page: 1,
};

export type CatalogFacets = {
  categories: { label: string; count: number }[];
  brands: { label: string; count: number }[];
  priceBounds: { min: number; max: number };
};

/** Derive sidebar facets (category/brand counts + price bounds) from a real product list. */
export function computeFacets(products: ProductCardData[]): CatalogFacets {
  const categoryCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  let max = 0;
  for (const p of products) {
    if (p.category) categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
    if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
    if (p.price > max) max = p.price;
  }
  const byCountDesc = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || a[0].localeCompare(b[0], "es");
  return {
    categories: [...categoryCounts.entries()].sort(byCountDesc).map(([label, count]) => ({ label, count })),
    brands: [...brandCounts.entries()].sort(byCountDesc).map(([label, count]) => ({ label, count })),
    priceBounds: { min: 0, max: Math.max(max, 1) },
  };
}

/** Spanish labels ↔ sort keys for the toolbar `<select>`. */
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevancia" },
  { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" },
  { value: "newest", label: "Más nuevos" },
];

function matchesAvailability(p: ProductCardData, availability: string[]): boolean {
  if (availability.length === 0) return true;
  return availability.every((a) => {
    if (a === "in-stock") return p.stockStatus === "in-stock";
    if (a === "deals") return p.oldPrice != null && p.oldPrice > p.price;
    return true;
  });
}

export function filterProducts(products: ProductCardData[], q: CatalogQuery): ProductCardData[] {
  const text = q.query.trim().toLowerCase();
  return products.filter((p) => {
    if (text) {
      const haystack = `${p.name} ${p.brand} ${p.category}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    if (q.category !== null && p.category !== q.category) return false;
    if (q.brands.length > 0 && !q.brands.includes(p.brand)) return false;
    if (!matchesAvailability(p, q.availability)) return false;
    if (p.price > q.priceMax) return false;
    return true;
  });
}

function createdAtMs(p: ProductCardData): number {
  return p.createdAt ? new Date(p.createdAt).getTime() : 0;
}

export function sortProducts(list: ProductCardData[], sort: SortKey): ProductCardData[] {
  const copy = [...list];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "newest":
      return copy.sort((a, b) => createdAtMs(b) - createdAtMs(a));
    default:
      return copy;
  }
}

export function filterAndSort(products: ProductCardData[], q: CatalogQuery): ProductCardData[] {
  return sortProducts(filterProducts(products, q), q.sort);
}

/** How many filters differ from the default state (drives filter badges). */
export function countActiveFilters(q: CatalogQuery): number {
  let count = 0;
  if (q.category !== null) count += 1;
  count += q.brands.length;
  count += q.availability.length;
  if (q.priceMax !== defaultCatalogQuery.priceMax) count += 1;
  return count;
}
