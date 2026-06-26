"use client";

import { Check, Clock, Store, Truck } from "lucide-react";
import { cn, formatCOP } from "@/lib/utils";
import { SHIPPING_OPTIONS } from "@/lib/constants";

const ICONS: Record<string, typeof Truck> = {
  standard: Truck,
  express: Clock,
  pickup: Store,
};

export function ShippingOptions({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {SHIPPING_OPTIONS.map((opt) => {
        const active = value === opt.id;
        const Icon = ICONS[opt.id] ?? Truck;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "flex w-full items-center gap-3 rounded-cc-lg border bg-white p-4 text-left transition-[border-color,box-shadow] duration-[140ms]",
              active
                ? "border-cc-primary ring-2 ring-cc-primary/15"
                : "border-cc-border hover:border-cc-primary-border",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                active ? "bg-cc-primary text-white" : "bg-cc-soft text-cc-secondary",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-cc-text">{opt.label}</p>
              <p className="text-[12px] text-cc-muted">{opt.detail}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-[14px] font-bold",
                  opt.cost === 0 ? "text-cc-success" : "text-cc-text",
                )}
              >
                {opt.cost === 0 ? "Gratis" : formatCOP(opt.cost)}
              </span>
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full border",
                  active ? "border-cc-primary bg-cc-primary text-white" : "border-cc-border-strong",
                )}
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
