"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  initial = false,
  productName,
}: {
  initial?: boolean;
  productName: string;
}) {
  const [active, setActive] = useState(initial);

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active
          ? `Quitar ${productName} de favoritos`
          : `Agregar ${productName} a favoritos`
      }
      onClick={() => setActive((v) => !v)}
      className={cn(
        "cc-focus-ring grid h-[34px] w-[34px] place-items-center rounded-full border border-transparent text-cc-text",
        "transition-[transform,background,color,border-color] duration-[140ms] ease-cc-out",
        "hover:border-cc-border hover:bg-cc-primary-softer hover:text-cc-primary",
        active && "text-cc-primary",
      )}
    >
      <Heart
        className={cn(
          "h-[18px] w-[18px] transition-transform duration-[140ms] ease-cc-spring",
          active && "scale-110 fill-cc-primary",
        )}
        strokeWidth={1.9}
      />
    </button>
  );
}
