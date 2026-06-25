"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  availabilityOptions,
  brands,
  categories,
  priceBounds,
  ratingFilters,
} from "@/lib/mock-products";
import {
  CategoryRow,
  CheckRow,
  FilterSection,
  PriceRange,
  RatingRow,
} from "./filter-parts";

/** 240px sticky filter sidebar (component-tree: FilterSidebar). */
export function FilterSidebar() {
  return (
    <aside className="hidden w-[240px] shrink-0 lg:block">
      <div className="sticky top-[84px] rounded-cc-lg border border-cc-border bg-cc-surface p-4 shadow-cc-xs">
        <header className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-cc-primary" strokeWidth={2} />
          <h2 className="text-sm font-bold text-cc-text">Filtros</h2>
        </header>

        <FilterSection title="Categorías">
          <div className="grid gap-0.5">
            {categories.map((category) => (
              <CategoryRow key={category.label} {...category} />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Rango de precio">
          <PriceRange min={priceBounds.min} max={priceBounds.max} />
        </FilterSection>

        <FilterSection title="Marca">
          <div className="grid gap-0.5">
            {brands.map((brand) => (
              <CheckRow key={brand.label} label={brand.label} count={brand.count} />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Valoración">
          <div className="grid gap-0.5">
            {ratingFilters.map((stars) => (
              <RatingRow key={stars} stars={stars} />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Disponibilidad">
          <div className="grid gap-0.5">
            {availabilityOptions.map((option) => (
              <CheckRow key={option.id} label={option.label} />
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}
