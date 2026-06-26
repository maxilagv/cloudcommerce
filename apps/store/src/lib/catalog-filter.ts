/**
 * Pure catalog filtering + sorting engine. No React, no stores — so it can be
 * reused by the homepage catalog store AND the /search results, and unit-tested
 * in isolation. When the backend lands, this logic moves server-side.
 */

import { categoryMatches, priceBounds, type ProductCardData } from "./mock-products";

export type SortKey = "relevance" | "price-asc" | "price-desc" | "rating" | "newest";

export type CatalogQuery = {
  query: string;
  category: string | null;
  brands: string[];
  rating: number | null;
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
  rating: null,
  availability: [],
  priceMax: priceBounds.max,
  sort: "relevance",
  page: 1,
};

/** Spanish labels ↔ sort keys for the toolbar `<select>`. */
export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevancia" },
  { value: "price-asc", label: "Menor precio" },
  { value: "price-desc", label: "Mayor precio" },
  { value: "rating", label: "Mejor valorados" },
  { value: "newest", label: "Más nuevos" },
];

function matchesAvailability(p: ProductCardData, availability: string[]): boolean {
  if (availability.length === 0) return true;
  return availability.some((a) => {
    if (a === "in-stock" || a === "today") return p.stockStatus === "in-stock";
    if (a === "pickup") return p.shipping === "pickup";
    return false;
  });
}

export function filterProducts(products: ProductCardData[], q: CatalogQuery): ProductCardData[] {
  const text = q.query.trim().toLowerCase();
  return products.filter((p) => {
    if (text) {
      const haystack = `${p.name} ${p.brand} ${p.category} ${p.features.join(" ")}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    // "Recomendados" chip is a curated high-rating view.
    if (q.category === "Recomendados" && p.rating < 4.7) return false;
    if (!categoryMatches(p.category, q.category)) return false;
    if (q.brands.length > 0 && !q.brands.includes(p.brand)) return false;
    if (q.rating != null && p.rating < q.rating) return false;
    if (!matchesAvailability(p, q.availability)) return false;
    if (p.price > q.priceMax) return false;
    return true;
  });
}

export function sortProducts(list: ProductCardData[], sort: SortKey): ProductCardData[] {
  const copy = [...list];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating);
    case "newest":
      // products flagged "new" float to the top, otherwise keep order
      return copy.sort(
        (a, b) => Number(b.badge?.type === "new") - Number(a.badge?.type === "new"),
      );
    default:
      return copy;
  }
}

export function filterAndSort(products: ProductCardData[], q: CatalogQuery): ProductCardData[] {
  return sortProducts(filterProducts(products, q), q.sort);
}
