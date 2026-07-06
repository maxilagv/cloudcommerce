"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ColorVariant, CapacityVariant } from "@/lib/product-detail-types";

interface VariantSelectorProps {
  colorVariants: ColorVariant[];
  capacityVariants: CapacityVariant[];
  defaultColor: string;
  defaultCapacity: string;
}

export function VariantSelector({
  colorVariants,
  capacityVariants,
  defaultColor,
  defaultCapacity,
}: VariantSelectorProps) {
  const [activeColor, setActiveColor] = useState(defaultColor);
  const [activeCapacity, setActiveCapacity] = useState(defaultCapacity);

  const activeColorLabel =
    colorVariants.find((c) => c.id === activeColor)?.label ?? "";
  const activeCapacityLabel =
    capacityVariants.find((c) => c.id === activeCapacity)?.label ?? "";

  // Products without variants render nothing (no empty headers).
  if (colorVariants.length === 0 && capacityVariants.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Color swatches */}
      {colorVariants.length > 0 && (
      <div>
        <p className="mb-2 text-[13px] text-cc-muted">
          Color:{" "}
          <span className="font-semibold text-cc-text">{activeColorLabel}</span>
        </p>
        <div className="flex gap-2.5">
          {colorVariants.map((color) => (
            <button
              key={color.id}
              type="button"
              title={color.label}
              aria-label={`Color ${color.label}`}
              aria-pressed={activeColor === color.id}
              onClick={() => setActiveColor(color.id)}
              className={cn(
                "h-7 w-7 rounded-full border-2 flex-shrink-0",
                "transition-all duration-[140ms] ease-cc-out hover:-translate-y-px hover:scale-105",
                "cc-focus-ring",
                activeColor === color.id
                  ? "border-cc-primary ring-2 ring-cc-primary/20 scale-110"
                  : "border-cc-border-strong hover:border-cc-primary-border",
              )}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>
      )}

      {/* Variant chips */}
      {capacityVariants.length > 0 && (
      <div>
        <p className="mb-2 text-[13px] text-cc-muted">
          Variante:{" "}
          <span className="font-semibold text-cc-text">{activeCapacityLabel}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {capacityVariants.map((cap) => (
            <button
              key={cap.id}
              type="button"
              aria-pressed={activeCapacity === cap.id}
              onClick={() => setActiveCapacity(cap.id)}
              className={cn(
                "h-8 px-3.5 rounded-full text-[12px] font-semibold border",
                "transition-all duration-[140ms] ease-cc-out hover:-translate-y-px",
                "cc-focus-ring",
                activeCapacity === cap.id
                  ? "bg-cc-primary text-white border-cc-primary shadow-[0_4px_12px_rgba(11,107,255,0.22)]"
                  : "bg-white text-cc-secondary border-cc-border hover:border-cc-primary-border hover:text-cc-primary",
              )}
            >
              {cap.label}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
