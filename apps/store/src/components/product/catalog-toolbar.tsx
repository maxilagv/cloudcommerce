"use client";

import { ChevronDown } from "lucide-react";
import { SORT_OPTIONS, type SortKey } from "@/lib/catalog-filter";
import type { CategoryLink, ProductCardData } from "@/lib/catalog-types";
import { useCatalog, useFilteredProducts } from "@/store/catalog";
import { MobileFilters } from "./mobile-filters";

export function CatalogToolbar({
  products,
  categories,
  activeCategory,
}: {
  products: ProductCardData[];
  categories?: CategoryLink[];
  activeCategory?: CategoryLink;
}) {
  const sort = useCatalog((s) => s.sort);
  const setSort = useCatalog((s) => s.setSort);
  const count = useFilteredProducts(products).length;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <MobileFilters
          products={products}
          categories={categories}
          activeCategory={activeCategory}
        />
        <p className="truncate text-sm text-cc-muted">
          <span className="font-semibold text-cc-text">
            {count.toLocaleString("es-AR")}
          </span>{" "}
          {count === 1 ? "producto" : "productos"}
          {activeCategory ? (
            <span className="hidden sm:inline"> en {activeCategory.label}</span>
          ) : null}
        </p>
      </div>

      <label className="flex shrink-0 items-center gap-2 text-sm text-cc-secondary">
        <span className="hidden sm:inline">Ordenar por:</span>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="cc-focus-ring appearance-none rounded-cc-sm border border-cc-border bg-cc-surface py-2 pl-3 pr-9 text-sm font-medium text-cc-text transition-colors duration-[140ms] ease-cc-out hover:border-cc-primary-border"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
        </div>
      </label>
    </div>
  );
}
