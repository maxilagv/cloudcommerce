"use client";

import { PackageOpen } from "lucide-react";
import { PAGE_SIZE } from "@/lib/catalog-filter";
import type { ProductCardData } from "@/lib/catalog-types";
import { useCatalog, useFilteredProducts } from "@/store/catalog";
import { ProductGrid } from "./grid";

/** Client grid wrapper: filters the server-fetched products + paginates. */
export function CatalogResults({ products }: { products: ProductCardData[] }) {
  const filtered = useFilteredProducts(products);
  const page = useCatalog((s) => s.page);
  const setPage = useCatalog((s) => s.setPage);
  const reset = useCatalog((s) => s.reset);

  if (filtered.length === 0) {
    const emptyCatalog = products.length === 0;
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-cc-lg border border-dashed border-cc-border bg-cc-surface py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cc-soft">
          <PackageOpen className="h-8 w-8 text-cc-muted" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-cc-text">
            {emptyCatalog
              ? "No hay productos disponibles por el momento"
              : "No encontramos productos con esos filtros"}
          </p>
          <p className="mt-1 text-[13px] text-cc-muted">
            {emptyCatalog
              ? "Volvé a intentarlo en unos minutos."
              : "Probá ajustar o limpiar los filtros para ver más resultados."}
          </p>
        </div>
        {!emptyCatalog && (
          <button
            type="button"
            onClick={reset}
            className="rounded-[11px] bg-cc-primary px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    );
  }

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  return (
    <div>
      <ProductGrid products={visible} />
      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            className="cc-focus-ring rounded-full border border-cc-border bg-cc-surface px-8 py-3 text-[14px] font-semibold text-cc-text transition-colors duration-[140ms] hover:border-cc-primary-border hover:text-cc-primary"
          >
            Cargar más ({filtered.length - visible.length} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
