"use client";

import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

export function AddToCartButton({ productName }: { productName: string }) {
  const [added, setAdded] = useState(false);

  function handleClick() {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Agregar ${productName} al carrito`}
      className={cn(
        "cc-focus-ring mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-[11px] text-xs font-bold text-white",
        "transition-[transform,box-shadow,filter] duration-[160ms] ease-cc-out",
        "active:translate-y-0 active:scale-[0.99]",
        added
          ? "bg-cc-success shadow-[0_10px_22px_rgba(22,163,74,0.24)]"
          : "bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] shadow-[0_10px_22px_rgba(11,107,255,0.24)] hover:-translate-y-px hover:shadow-[0_14px_28px_rgba(11,107,255,0.32)] hover:brightness-[1.03]",
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
