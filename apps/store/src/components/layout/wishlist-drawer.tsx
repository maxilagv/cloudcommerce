"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { animate, AnimatePresence, motion, useMotionValue } from "motion/react";
import { Heart, ShoppingCart, X } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { useWishlist, useWishlistCount } from "@/store/wishlist";
import { useCart } from "@/store/cart";
import { productHref, type ProductCardData } from "@/lib/catalog-types";

const DRAG_CLOSE_DISTANCE = 320;

function WishlistItem({ product }: { product: ProductCardData }) {
  const remove = useWishlist((s) => s.remove);
  const addToCart = useCart((s) => s.add);

  function handleAddToCart() {
    addToCart(product);
    remove(product.id);
  }

  return (
    <div className="flex gap-3 border-b border-cc-border-subtle py-4 last:border-0">
      {/* Thumbnail */}
      <Link
        href={productHref(product)}
        className="h-16 w-16 shrink-0 rounded-cc-sm bg-cc-bg-surface-soft flex items-center justify-center overflow-hidden hover:opacity-90 transition-opacity"
      >
        <Image
          src={product.image}
          alt={product.imageAlt}
          width={64}
          height={64}
          className="h-14 w-14 object-contain"
        />
      </Link>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-cc-muted">
          {product.brand}
        </p>
        <Link
          href={productHref(product)}
          className="text-[13px] font-medium leading-snug text-cc-text line-clamp-2 hover:text-cc-primary transition-colors"
        >
          {product.name}
        </Link>
        <p className="text-[14px] font-extrabold tracking-tight text-cc-text">
          {formatPrice(product.price)}
        </p>

        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-cc-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
          >
            <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />
            Al carrito
          </button>
          <button
            type="button"
            onClick={() => remove(product.id)}
            aria-label={`Quitar ${product.name} de favoritos`}
            className={cn(
              "grid h-[34px] w-[34px] place-items-center rounded-[8px] border border-cc-border text-cc-primary",
              "transition-colors hover:border-cc-danger/30 hover:bg-cc-danger-soft hover:text-cc-danger",
            )}
          >
            <Heart className="h-4 w-4 fill-cc-primary" strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function WishlistDrawer() {
  const isOpen = useWishlist((s) => s.isOpen);
  const close = useWishlist((s) => s.close);
  const items = useWishlist((s) => s.items);
  const count = useWishlistCount();
  const backdropOpacity = useMotionValue(isOpen ? 1 : 0);

  // Open/close fades the backdrop over 220ms. During a drag we set its opacity
  // directly (below) with no easing, so it tracks the finger instead of lagging
  // behind a CSS transition.
  useEffect(() => {
    const controls = animate(backdropOpacity, isOpen ? 1 : 0, {
      duration: 0.22,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [isOpen, backdropOpacity]);

  return (
    <>
      {/* Overlay */}
      <motion.div
        aria-hidden="true"
        onClick={close}
        style={{ opacity: backdropOpacity }}
        className={`fixed inset-0 z-40 bg-black/40 ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      />

      {/* Panel — spring physics + swipe-to-close */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Mis favoritos"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.04, right: 0.5 }}
        onDrag={(_, info) => {
          const progress = Math.min(Math.max(info.offset.x, 0) / DRAG_CLOSE_DISTANCE, 1);
          backdropOpacity.set(1 - progress);
        }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 120 || info.velocity.x > 500) {
            close();
          } else {
            animate(backdropOpacity, 1, { duration: 0.18, ease: [0.22, 1, 0.36, 1] });
          }
        }}
        initial={false}
        animate={{ x: isOpen ? "0%" : "100%" }}
        transition={spring.snappy}
        style={{ pointerEvents: isOpen ? "auto" : "none" }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cc-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 fill-cc-primary text-cc-primary" strokeWidth={1.9} />
            <h2 className="text-[16px] font-bold text-cc-text">
              Mis favoritos
              {count > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cc-primary px-1.5 text-[11px] font-bold text-white">
                  {count}
                </span>
              )}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar favoritos"
            className="cc-focus-ring grid h-8 w-8 place-items-center rounded-cc-sm text-cc-muted transition-colors duration-[140ms] hover:bg-cc-bg-surface-soft hover:text-cc-text"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cc-bg-surface-soft">
                <Heart className="h-8 w-8 text-cc-muted" strokeWidth={1.5} />
              </div>
              <p className="text-[15px] font-semibold text-cc-text">
                No tenés favoritos aún
              </p>
              <p className="text-[13px] text-cc-muted max-w-[200px]">
                Guardá productos que te gusten tocando el corazón
              </p>
              <button
                type="button"
                onClick={close}
                className="mt-2 rounded-[11px] bg-cc-primary px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <div>
              <AnimatePresence initial={false}>
                {items.map((product) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={spring.gentle}
                    style={{ overflow: "hidden" }}
                  >
                    <WishlistItem product={product} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-cc-border px-5 py-4">
            <p className="text-center text-[12px] text-cc-muted">
              {count} {count === 1 ? "producto guardado" : "productos guardados"}
            </p>
          </div>
        )}
      </motion.div>
    </>
  );
}
