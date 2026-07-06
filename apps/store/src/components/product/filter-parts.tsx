"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

/** Collapsible filter section with chevron rotation + grid-rows accordion. */
export function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-t border-cc-border-subtle py-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="cc-focus-ring flex w-full items-center justify-between text-[13px] font-semibold text-cc-text"
      >
        {title}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-cc-muted transition-transform duration-[220ms] ease-cc-out",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[220ms] ease-cc-out",
          open ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </section>
  );
}

export function CategoryRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "cc-focus-ring flex w-full items-center justify-between rounded-cc-sm px-2 py-1.5 text-[13px] transition-colors duration-[140ms] ease-cc-out",
        active
          ? "bg-cc-primary-soft font-semibold text-cc-primary"
          : "text-cc-secondary hover:bg-cc-soft hover:text-cc-text",
      )}
    >
      {label}
      <span className={cn("text-xs", active ? "text-cc-primary" : "text-cc-faint")}>
        {count}
      </span>
    </button>
  );
}

export function CheckRow({
  label,
  count,
  checked = false,
  onChange,
}: {
  label: string;
  count?: number;
  checked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-cc-sm px-2 py-1.5 text-[13px] text-cc-secondary transition-colors duration-[140ms] ease-cc-out hover:bg-cc-soft">
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            "grid h-[18px] w-[18px] place-items-center rounded-[6px] border transition-colors duration-[140ms] ease-cc-out",
            checked ? "border-cc-primary bg-cc-primary" : "border-cc-border-strong bg-white",
          )}
        >
          {checked ? (
            <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none">
              <path
                d="M3.5 8.5l3 3 6-6.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onChange?.()}
          className="sr-only"
        />
        {label}
      </span>
      {typeof count === "number" ? (
        <span className="text-xs text-cc-faint">{count}</span>
      ) : null}
    </label>
  );
}

/** Price range with a single draggable upper bound (controlled). */
export function PriceRange({
  min,
  max,
  step = 50000,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="relative h-5">
        <span className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-cc-border" />
        <span
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-cc-primary"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Precio máximo"
          className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cc-primary [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-cc-sm [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110"
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-cc-muted">
        <span>{formatPrice(min)}</span>
        <span className="font-semibold text-cc-text">{formatPrice(value)}</span>
      </div>
    </div>
  );
}
