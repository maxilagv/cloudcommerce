"use client";

import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";
import type { ProductCardData } from "@/lib/mock-products";

export function AddToCartButton({
  product,
  size = "md",
}: {
  product: ProductCardData;
  size?: "md" | "lg";
}) {
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    add(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Agregar ${product.name} al carrito`}
      className={cn(
        "cc-focus-ring flex w-full items-center justify-center gap-2 rounded-[11px] font-bold text-white",
        size === "lg" ? "mt-0 h-12 text-sm" : "mt-2.5 h-9 text-xs",
        "transition-[transform,box-shadow,filter] duration-[160ms] ease-cc-out",
        "active:translate-y-0 active:scale-[0.99]",
        added
          ? "bg-cc-success shadow-[0_10px_22px_rgba(22,163,74,0.24)]"
          : "bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] shadow-[0_10px_22px_rgba(11,107,255,0.24)] hover:-translate-y-px hover:brightness-[1.03] hover:shadow-[0_14px_28px_rgba(11,107,255,0.32)]",
      )}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" strokeWidth={2.4} />
          Agregado
        </>
      ) : (
        <>
          <ShoppingCart className="h-4 w-4" strokeWidth={2} />
          Agregar al carrito
        </>
      )}
    </button>
  );
}
