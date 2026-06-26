"use client";

import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useFilteredProducts } from "@/store/catalog";
import { FilterSidebar } from "./filters";
import { CatalogToolbar } from "./catalog-toolbar";
import { CatalogResults } from "./catalog-results";
import { CatalogSync } from "./catalog-sync";

export function SearchResults() {
  const query = useSearchParams().get("q") ?? "";
  const count = useFilteredProducts().length;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6">
      {/* Seed the shared catalog store from the URL query */}
      <CatalogSync query={query} />

      <FilterSidebar />

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
              {count.toLocaleString("es-CO")}{" "}
              {count === 1 ? "producto encontrado" : "productos encontrados"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <CatalogToolbar />
        </div>

        <div className="mt-5">
          <CatalogResults />
        </div>
      </div>
    </div>
  );
}
