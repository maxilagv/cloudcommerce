"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/store/wishlist";
import { toast } from "@/store/toast";
import type { ProductCardData } from "@/lib/mock-products";

export function FavoriteButton({
  product,
  showLabel = false,
}: {
  product: ProductCardData;
  showLabel?: boolean;
}) {
  const toggle = useWishlist((s) => s.toggle);
  const openWishlist = useWishlist((s) => s.open);
  const active = useWishlist((s) => s.has(product.id));

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    toggle(product);
    if (active) {
      toast.info("Quitado de favoritos", { description: product.name });
    } else {
      toast.success("Agregado a favoritos", {
        description: product.name,
        actionLabel: "Ver favoritos",
        onAction: openWishlist,
      });
    }
  }

  if (showLabel) {
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={handleClick}
        className={cn(
          "cc-focus-ring flex h-12 flex-1 items-center justify-center gap-2 rounded-[11px] border text-[13px] font-semibold",
          "transition-[transform,background,color,border-color,box-shadow] duration-[140ms] ease-cc-out",
          active
            ? "border-cc-primary bg-cc-primary-soft text-cc-primary"
            : "border-cc-border text-cc-secondary hover:border-cc-primary-border hover:bg-cc-primary-softer hover:text-cc-primary",
        )}
      >
        <Heart
          className={cn(
            "h-[17px] w-[17px] transition-transform duration-[140ms] ease-cc-spring",
            active && "scale-110 fill-cc-primary",
          )}
          strokeWidth={1.9}
        />
        {active ? "En favoritos" : "Agregar a favoritos"}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={
        active
          ? `Quitar ${product.name} de favoritos`
          : `Agregar ${product.name} a favoritos`
      }
      onClick={handleClick}
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
