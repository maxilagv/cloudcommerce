"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { countActiveFilters } from "@/lib/catalog-filter";
import { cn } from "@/lib/utils";
import { useCatalog, useCatalogQuery, useFilteredProducts } from "@/store/catalog";
import { FilterPanel, type FilterPanelProps } from "./filters";

/**
 * Mobile filters: trigger button + bottom-sheet drawer (slides up, backdrop
 * blur, body scroll-lock). Reuses the exact same FilterPanel as desktop so
 * behavior never diverges.
 */
export function MobileFilters(props: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const q = useCatalogQuery();
  const reset = useCatalog((s) => s.reset);
  const count = useFilteredProducts(props.products).length;
  const activeCount = countActiveFilters(q) + (props.activeCategory ? 1 : 0);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Close with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cc-focus-ring relative inline-flex h-10 items-center gap-2 rounded-full border border-cc-border bg-cc-surface px-4 text-[13px] font-semibold text-cc-text transition-[transform,border-color,box-shadow] duration-[140ms] ease-cc-out hover:border-cc-primary-border active:scale-[0.97]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SlidersHorizontal className="h-4 w-4 text-cc-primary" strokeWidth={2} />
        Filtros
        {activeCount > 0 && (
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-cc-primary px-1 text-[10px] font-bold text-white animate-[cc-badge-pop_300ms_ease-cc-spring]">
            {activeCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px] transition-opacity duration-[220ms] ease-cc-out",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtros del catálogo"
        className={cn(
          "fixed inset-x-0 bottom-0 z-[71] flex max-h-[85dvh] flex-col rounded-t-[24px] bg-cc-surface shadow-[0_-18px_50px_rgba(16,24,40,0.22)]",
          "transition-transform duration-[280ms] ease-cc-out",
          open ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-cc-border-subtle px-5 pb-3 pt-4">
          <span className="mx-auto absolute inset-x-0 top-2 flex justify-center">
            <span className="h-1 w-10 rounded-full bg-cc-border" />
          </span>
          <h2 className="text-[15px] font-bold text-cc-text">Filtros</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar filtros"
            className="cc-focus-ring grid h-9 w-9 place-items-center rounded-full text-cc-muted transition-colors duration-[140ms] hover:bg-cc-soft hover:text-cc-text"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <FilterPanel {...props} />
        </div>

        <div className="flex items-center gap-3 border-t border-cc-border-subtle px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={reset}
            className="cc-focus-ring h-11 shrink-0 rounded-full border border-cc-border px-5 text-[13px] font-semibold text-cc-secondary transition-colors duration-[140ms] hover:border-cc-primary-border hover:text-cc-primary"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="cc-focus-ring h-11 flex-1 rounded-full bg-cc-primary text-[14px] font-bold text-white shadow-[0_12px_26px_rgba(11,107,255,.25)] transition-[transform,background] duration-[140ms] ease-cc-out hover:bg-cc-primary-hover active:scale-[0.985]"
          >
            Ver {count} {count === 1 ? "producto" : "productos"}
          </button>
        </div>
      </div>
    </div>
  );
}
