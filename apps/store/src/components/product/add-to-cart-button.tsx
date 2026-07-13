"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useCart } from "@/store/cart";
import { toast } from "@/store/toast";
import type { ProductCardData } from "@/lib/catalog-types";

type FlyState = { src: string; from: DOMRect; to: DOMRect };

/** Clones the product image and flies it from its on-page position to the
 *  header cart icon. Purely decorative — the cart mutation (and its badge
 *  pop) already happened synchronously; this just reinforces it visually. */
function FlyToCart({ fly, onDone }: { fly: FlyState; onDone: () => void }) {
  if (typeof document === "undefined") return null;
  const targetCx = fly.to.left + fly.to.width / 2 - 8;
  const targetCy = fly.to.top + fly.to.height / 2 - 8;
  return createPortal(
    <motion.img
      src={fly.src}
      alt=""
      aria-hidden="true"
      initial={{
        left: fly.from.left,
        top: fly.from.top,
        width: fly.from.width,
        height: fly.from.height,
        opacity: 1,
      }}
      animate={{ left: targetCx, top: targetCy, width: 16, height: 16, opacity: 0.5 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={onDone}
      className="pointer-events-none fixed z-[200] rounded-cc-xs object-contain"
    />,
    document.body,
  );
}

export function AddToCartButton({
  product,
  size = "md",
  quantity = 1,
}: {
  product: ProductCardData;
  size?: "md" | "lg";
  quantity?: number;
}) {
  const [added, setAdded] = useState(false);
  const [fly, setFly] = useState<FlyState | null>(null);
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.open);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    add(product, quantity);
    setAdded(true);
    toast.success("Agregado al carrito", {
      description: quantity > 1 ? `${product.name} × ${quantity}` : product.name,
      actionLabel: "Ver carrito",
      onAction: openCart,
    });
    window.setTimeout(() => setAdded(false), 1500);

    const sourceImg = document.querySelector<HTMLImageElement>(
      `img[data-fly-image="${product.id}"]`,
    );
    const target = document.getElementById("cc-cart-icon-target");
    if (sourceImg && target && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFly({
        src: sourceImg.currentSrc || sourceImg.src,
        from: sourceImg.getBoundingClientRect(),
        to: target.getBoundingClientRect(),
      });
    }
  }

  return (
    <>
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
            : "bg-[linear-gradient(180deg,var(--cc-primary-btn-top)_0%,var(--cc-primary-btn-bottom)_100%)] shadow-[0_10px_22px_rgba(11,107,255,0.24)] hover:-translate-y-px hover:brightness-[1.03] hover:shadow-[0_14px_28px_rgba(11,107,255,0.32)]",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {added ? (
            <motion.span
              key="added"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={spring.snappy}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" strokeWidth={2.4} />
              Agregado
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={spring.snappy}
              className="flex items-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" strokeWidth={2} />
              Agregar al carrito
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {fly && <FlyToCart fly={fly} onDone={() => setFly(null)} />}
    </>
  );
}
