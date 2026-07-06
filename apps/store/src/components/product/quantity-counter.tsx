"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityCounter({
  min = 1,
  max = 99,
  initial = 1,
  value,
  onChange,
}: {
  min?: number;
  max?: number;
  initial?: number;
  /** Modo controlado: la cantidad vive en el padre (precio por cantidad). */
  value?: number;
  onChange?: (quantity: number) => void;
}) {
  const [internalQty, setInternalQty] = useState(initial);
  const [bump, setBump] = useState(false);
  const qty = value ?? internalQty;

  function change(next: number) {
    if (next < min || next > max) return;
    if (value === undefined) setInternalQty(next);
    onChange?.(next);
    setBump(true);
    setTimeout(() => setBump(false), 140);
  }

  return (
    <div className="flex items-center">
      <div className="flex items-center h-[38px] rounded-cc-md border border-cc-border bg-white overflow-hidden">
        <button
          type="button"
          aria-label="Reducir cantidad"
          disabled={qty <= min}
          onClick={() => change(qty - 1)}
          className={cn(
            "h-full w-10 flex items-center justify-center text-cc-secondary",
            "transition-colors duration-[90ms] hover:bg-cc-soft hover:text-cc-text",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "cc-focus-ring",
          )}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>

        <span
          className={cn(
            "w-10 text-center text-[14px] font-bold text-cc-text tabular-nums select-none",
            "transition-transform duration-[90ms] ease-cc-spring",
            bump && "scale-110",
          )}
        >
          {qty}
        </span>

        <button
          type="button"
          aria-label="Aumentar cantidad"
          disabled={qty >= max}
          onClick={() => change(qty + 1)}
          className={cn(
            "h-full w-10 flex items-center justify-center text-cc-secondary",
            "transition-colors duration-[90ms] hover:bg-cc-soft hover:text-cc-text",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "cc-focus-ring",
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      <span className="ml-3 text-[12px] text-cc-muted">
        {max > 50 ? "Disponible" : `${max} disponibles`}
      </span>
    </div>
  );
}
