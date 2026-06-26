"use client";

import { ChevronDown, MapPin } from "lucide-react";

export function LocationSelector() {
  return (
    <button
      type="button"
      className="cc-focus-ring hidden shrink-0 items-center gap-1.5 rounded-cc-sm px-2 py-1.5 text-[13px] text-cc-secondary transition-colors duration-[140ms] ease-cc-out hover:bg-cc-soft hover:text-cc-text xl:flex"
    >
      <MapPin className="h-4 w-4 text-cc-primary" strokeWidth={2} />
      <span className="font-medium">Bogotá, CO</span>
      <ChevronDown className="h-3.5 w-3.5 text-cc-muted" />
    </button>
  );
}
