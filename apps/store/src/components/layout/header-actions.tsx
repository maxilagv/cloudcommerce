"use client";

import { Heart, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";

function ActionButton({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="cc-focus-ring relative grid h-10 w-10 place-items-center rounded-cc-sm text-cc-secondary transition-[color,background] duration-[140ms] ease-cc-out hover:bg-cc-primary-softer hover:text-cc-primary"
    >
      {children}
      {typeof count === "number" && count > 0 ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-cc-primary px-1 text-[10px] font-bold text-white",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function HeaderActions() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <ActionButton label="Mi cuenta">
        <User className="h-[22px] w-[22px]" strokeWidth={1.85} />
      </ActionButton>
      <ActionButton label="Favoritos" count={3}>
        <Heart className="h-[22px] w-[22px]" strokeWidth={1.85} />
      </ActionButton>
      <ActionButton label="Carrito" count={2}>
        <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={1.85} />
      </ActionButton>
    </div>
  );
}
