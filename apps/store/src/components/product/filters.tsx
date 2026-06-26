"use client";

import { SlidersHorizontal, X } from "lucide-react";
import {
  availabilityOptions,
  brands,
  categories,
  priceBounds,
  ratingFilters,
} from "@/lib/mock-products";
import { useCatalog, useCatalogQuery } from "@/store/catalog";
import {
  CategoryRow,
  CheckRow,
  FilterSection,
  PriceRange,
  RatingRow,
} from "./filter-parts";

/** 240px sticky filter sidebar — fully wired to the catalog store. */
export function FilterSidebar() {
  const q = useCatalogQuery();
  const {
    setCategory,
    toggleBrand,
    setRating,
    toggleAvailability,
    setPriceMax,
    reset,
  } = useCatalog();

  const hasActiveFilters =
    q.category !== null ||
    q.brands.length > 0 ||
    q.rating !== null ||
    q.availability.length > 0 ||
    q.priceMax !== priceBounds.max;

  return (
    <aside className="hidden w-[240px] shrink-0 lg:block">
      <div className="sticky top-[84px] rounded-cc-lg border border-cc-border bg-cc-surface p-4 shadow-cc-xs">
        <header className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-cc-primary" strokeWidth={2} />
            <h2 className="text-sm font-bold text-cc-text">Filtros</h2>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-[12px] font-medium text-cc-primary hover:underline"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
              Limpiar
            </button>
          )}
        </header>

        <FilterSection title="Categorías">
          <div className="grid gap-0.5">
            {categories.map((category) => (
              <CategoryRow
                key={category.label}
                label={category.label}
                count={category.count}
                active={q.category === category.label}
                onClick={() => setCategory(category.label)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Rango de precio">
          <PriceRange
            min={priceBounds.min}
            max={priceBounds.max}
            value={q.priceMax}
            onChange={setPriceMax}
          />
        </FilterSection>

        <FilterSection title="Marca">
          <div className="grid gap-0.5">
            {brands.map((brand) => (
              <CheckRow
                key={brand.label}
                label={brand.label}
                count={brand.count}
                checked={q.brands.includes(brand.label)}
                onChange={() => toggleBrand(brand.label)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Valoración">
          <div className="grid gap-0.5">
            {ratingFilters.map((stars) => (
              <RatingRow
                key={stars}
                stars={stars}
                active={q.rating === stars}
                onClick={() => setRating(stars)}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection title="Disponibilidad">
          <div className="grid gap-0.5">
            {availabilityOptions.map((option) => (
              <CheckRow
                key={option.id}
                label={option.label}
                checked={q.availability.includes(option.id)}
                onChange={() => toggleAvailability(option.id)}
              />
            ))}
          </div>
        </FilterSection>
      </div>
    </aside>
  );
}
