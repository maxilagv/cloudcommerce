"use client";

import { Search } from "lucide-react";

export function SearchCommand() {
  return (
    <div className="group relative hidden min-w-0 flex-1 md:block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-cc-muted transition-colors group-focus-within:text-cc-primary" />
      <input
        type="search"
        placeholder="Buscar producto, categoría o más..."
        className="h-10 w-full rounded-cc-md border border-cc-border bg-cc-soft pl-10 pr-4 text-sm text-cc-text outline-none transition-[background,border-color,box-shadow] duration-[140ms] ease-cc-out placeholder:text-cc-muted focus:border-cc-primary-border focus:bg-white focus:shadow-cc-focus"
      />
    </div>
  );
}
