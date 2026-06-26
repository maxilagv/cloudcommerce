"use client";

import { ChevronDown } from "lucide-react";
import { SORT_OPTIONS, type SortKey } from "@/lib/catalog-filter";
import { useCatalog, useFilteredProducts } from "@/store/catalog";

export function CatalogToolbar() {
  const sort = useCatalog((s) => s.sort);
  const setSort = useCatalog((s) => s.setSort);
  const count = useFilteredProducts().length;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-cc-muted">
        <span className="font-semibold text-cc-text">
          {count.toLocaleString("es-CO")}
        </span>{" "}
        {count === 1 ? "producto encontrado" : "productos encontrados"}
      </p>

      <label className="flex items-center gap-2 text-sm text-cc-secondary">
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
