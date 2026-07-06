"use client";

import { useMemo } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";
import {
  availabilityOptions,
  categoryHref,
  type CategoryLink,
  type ProductCardData,
} from "@/lib/catalog-types";
import { computeFacets, defaultCatalogQuery } from "@/lib/catalog-filter";
import { cn } from "@/lib/utils";
import { useCatalog, useCatalogQuery } from "@/store/catalog";
import { CheckRow, FilterSection, PriceRange } from "./filter-parts";

export type FilterPanelProps = {
  products: ProductCardData[];
  categories?: CategoryLink[];
  activeCategory?: CategoryLink;
};

/**
 * Filter content shared by the desktop sidebar and the mobile drawer.
 * Categories are real links (server-narrowed landings); brand, price and
 * availability refine the fetched list client-side.
 */
export function FilterPanel({ products, categories = [], activeCategory }: FilterPanelProps) {
  const q = useCatalogQuery();
  const { toggleBrand, toggleAvailability, setPriceMax, reset } = useCatalog();

  const facets = useMemo(() => computeFacets(products), [products]);

  const hasActiveFilters =
    q.brands.length > 0 ||
    q.availability.length > 0 ||
    q.priceMax !== defaultCatalogQuery.priceMax;

  const priceValue = Math.min(q.priceMax, facets.priceBounds.max);
  const priceStep = Math.max(1, Math.round(facets.priceBounds.max / 100));

  return (
    <div>
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

      {categories.length > 0 && (
        <FilterSection title="Categorías">
          <nav aria-label="Categorías" className="grid gap-0.5">
            <CategoryLinkRow
              label="Todas las categorías"
              href="/products#catalogo"
              active={!activeCategory}
            />
            {categories.map((category) => (
              <CategoryLinkRow
                key={category.slug}
                label={category.label}
                href={`${categoryHref(category.slug)}#catalogo`}
                active={category.slug === activeCategory?.slug}
              />
            ))}
          </nav>
        </FilterSection>
      )}

      {facets.priceBounds.max > 1 && (
        <FilterSection title="Rango de precio">
          <PriceRange
            min={facets.priceBounds.min}
            max={facets.priceBounds.max}
            step={priceStep}
            value={priceValue}
            onChange={setPriceMax}
          />
        </FilterSection>
      )}

      {facets.brands.length > 0 && (
        <FilterSection title="Marca">
          <div className="grid gap-0.5">
            {facets.brands.map((brand) => (
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
      )}

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
  );
}

function CategoryLinkRow({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "cc-focus-ring flex w-full items-center justify-between rounded-cc-sm px-2 py-1.5 text-[13px] transition-colors duration-[140ms] ease-cc-out",
        active
          ? "bg-cc-primary-soft font-semibold text-cc-primary"
          : "text-cc-secondary hover:bg-cc-soft hover:text-cc-text",
      )}
    >
      {label}
    </Link>
  );
}

/** 240px sticky filter sidebar (desktop only — mobile uses the drawer). */
export function FilterSidebar(props: FilterPanelProps) {
  return (
    <aside className="hidden w-[240px] shrink-0 lg:block">
      <div className="sticky top-[84px] rounded-cc-lg border border-cc-border bg-cc-surface p-4 shadow-cc-xs">
        <FilterPanel {...props} />
      </div>
    </aside>
  );
}
