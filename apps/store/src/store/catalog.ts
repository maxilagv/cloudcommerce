"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { mockProducts } from "@/lib/mock-products";
import {
  defaultCatalogQuery,
  filterAndSort,
  type CatalogQuery,
  type SortKey,
} from "@/lib/catalog-filter";

type CatalogStore = CatalogQuery & {
  setQuery: (query: string) => void;
  setCategory: (category: string | null) => void;
  toggleBrand: (brand: string) => void;
  setRating: (rating: number | null) => void;
  toggleAvailability: (id: string) => void;
  setPriceMax: (priceMax: number) => void;
  setSort: (sort: SortKey) => void;
  setPage: (page: number) => void;
  reset: () => void;
};

/**
 * Ephemeral catalog state (NOT persisted — persisting filters would diverge
 * from the statically rendered home page and cause hydration mismatches).
 * Every mutation except `setPage` resets pagination to page 1.
 */
export const useCatalog = create<CatalogStore>((set) => ({
  ...defaultCatalogQuery,
  setQuery: (query) => set({ query, page: 1 }),
  setCategory: (category) =>
    set((s) => ({ category: s.category === category ? null : category, page: 1 })),
  toggleBrand: (brand) =>
    set((s) => ({
      brands: s.brands.includes(brand)
        ? s.brands.filter((b) => b !== brand)
        : [...s.brands, brand],
      page: 1,
    })),
  setRating: (rating) => set((s) => ({ rating: s.rating === rating ? null : rating, page: 1 })),
  toggleAvailability: (id) =>
    set((s) => ({
      availability: s.availability.includes(id)
        ? s.availability.filter((a) => a !== id)
        : [...s.availability, id],
      page: 1,
    })),
  setPriceMax: (priceMax) => set({ priceMax, page: 1 }),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  reset: () => set({ ...defaultCatalogQuery }),
}));

/** Shallow-stable snapshot of just the query fields (no actions). */
export function useCatalogQuery(): CatalogQuery {
  return useCatalog(
    useShallow((s) => ({
      query: s.query,
      category: s.category,
      brands: s.brands,
      rating: s.rating,
      availability: s.availability,
      priceMax: s.priceMax,
      sort: s.sort,
      page: s.page,
    })),
  );
}

/** Filtered + sorted product list driven by current catalog state. */
export function useFilteredProducts() {
  const q = useCatalogQuery();
  return useMemo(() => filterAndSort(mockProducts, q), [q]);
}
