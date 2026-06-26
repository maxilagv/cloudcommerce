"use client";

import { useState } from "react";
import { chips } from "@/lib/mock-products";
import { cn } from "@/lib/utils";

export function CategoryChips() {
  const [active, setActive] = useState(chips[0]);

  return (
    <div className="cc-no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
      {chips.map((chip) => {
        const isActive = chip === active;
        return (
          <button
            key={chip}
            type="button"
            onClick={() => setActive(chip)}
            aria-pressed={isActive}
            className={cn(
              "cc-focus-ring shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium",
              "transition-[transform,background,border-color,color,box-shadow] duration-[180ms] ease-cc-out",
              isActive
                ? "border-cc-primary bg-cc-primary text-white shadow-[0_8px_18px_rgba(11,107,255,0.22)]"
                : "border-cc-border bg-cc-surface text-cc-secondary hover:-translate-y-px hover:border-cc-primary-border hover:text-cc-text hover:shadow-cc-sm",
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
