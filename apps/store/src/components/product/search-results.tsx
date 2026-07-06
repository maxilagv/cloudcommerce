"use client";

import { Search } from "lucide-react";
import type { ProductCardData } from "@/lib/catalog-types";
import { useFilteredProducts } from "@/store/catalog";
import { FilterSidebar } from "./filters";
import { CatalogToolbar } from "./catalog-toolbar";
import { CatalogResults } from "./catalog-results";
import { CatalogSync } from "./catalog-sync";

/**
 * Results view for /search: the API already filtered by `query`, so the shared
 * catalog store is reset here and only refines client-side (brand, price...).
 */
export function SearchResults({
  query,
  products,
}: {
  query: string;
  products: ProductCardData[];
}) {
  const count = useFilteredProducts(products).length;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6">
      {/* Reset the shared catalog store per search (server did the text match) */}
      <CatalogSync resetKey={query} />

      <FilterSidebar products={products} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b border-cc-border-subtle pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cc-primary-soft">
            <Search className="h-5 w-5 text-cc-primary" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-cc-text">
              Resultados para “{query}”
            </h1>
            <p className="text-[13px] text-cc-muted">
              {count.toLocaleString("es-AR")}{" "}
              {count === 1 ? "producto encontrado" : "productos encontrados"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <CatalogToolbar products={products} />
        </div>

        <div className="mt-5">
          <CatalogResults products={products} />
        </div>
      </div>
    </div>
  );
}
