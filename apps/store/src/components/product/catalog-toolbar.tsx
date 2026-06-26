"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { totalResults } from "@/lib/mock-products";

const SORT_OPTIONS = [
  "Relevancia",
  "Menor precio",
  "Mayor precio",
  "Mejor valorados",
  "Más nuevos",
];

export function CatalogToolbar() {
  const [sort, setSort] = useState(SORT_OPTIONS[0]);

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-cc-muted">
        <span className="font-semibold text-cc-text">
          {totalResults.toLocaleString("es-CO")}
        </span>{" "}
        productos encontrados
      </p>

      <label className="flex items-center gap-2 text-sm text-cc-secondary">
        <span className="hidden sm:inline">Ordenar por:</span>
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="cc-focus-ring appearance-none rounded-cc-sm border border-cc-border bg-cc-surface py-2 pl-3 pr-9 text-sm font-medium text-cc-text transition-colors duration-[140ms] ease-cc-out hover:border-cc-primary-border"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cc-muted" />
        </div>
      </label>
    </div>
  );
}
