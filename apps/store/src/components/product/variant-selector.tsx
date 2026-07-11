"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
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
              className="cc-focus-ring relative grid h-7 w-7 flex-shrink-0 place-items-center rounded-full"
            >
              {activeColor === color.id && (
                <motion.span
                  layoutId="color-active-ring"
                  transition={spring.snappy}
                  className="absolute -inset-[3px] rounded-full ring-2 ring-cc-primary/40"
                />
              )}
              <span
                className={cn(
                  "h-full w-full rounded-full border-2 transition-transform duration-[140ms] ease-cc-out hover:-translate-y-px hover:scale-105",
                  activeColor === color.id
                    ? "scale-110 border-cc-primary"
                    : "border-cc-border-strong hover:border-cc-primary-border",
                )}
                style={{ backgroundColor: color.hex }}
              />
            </button>
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
                "relative h-8 flex-shrink-0 rounded-full px-3.5 text-[12px] font-semibold",
                "transition-[color,transform] duration-[140ms] ease-cc-out hover:-translate-y-px",
                "cc-focus-ring",
                activeCapacity === cap.id
                  ? "text-white"
                  : "border border-cc-border text-cc-secondary hover:border-cc-primary-border hover:text-cc-primary",
              )}
            >
              {activeCapacity === cap.id && (
                <motion.span
                  layoutId="capacity-active-pill"
                  transition={spring.snappy}
                  className="absolute inset-0 -z-10 rounded-full bg-cc-primary shadow-[0_4px_12px_rgba(11,107,255,0.22)]"
                />
              )}
              {cap.label}
            </button>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}
