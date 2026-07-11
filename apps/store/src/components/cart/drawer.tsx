"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { ShoppingCart, X } from "lucide-react";
import { spring } from "@/lib/motion";
import { useCart, useCartCount } from "@/store/cart";
import { CartItem } from "./item";
import { CartSummary } from "./summary";

const DRAG_CLOSE_DISTANCE = 320;

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const count = useCartCount();
  const backdropOpacity = useMotionValue(isOpen ? 1 : 0);

  useEffect(() => {
    backdropOpacity.set(isOpen ? 1 : 0);
  }, [isOpen, backdropOpacity]);

  return (
    <>
      {/* Overlay — its opacity is also driven live by the panel's drag progress */}
      <motion.div
        aria-hidden="true"
        onClick={close}
        style={{ opacity: backdropOpacity }}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      />

      {/* Panel — spring physics + swipe-to-close (drag right past the threshold) */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
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
            backdropOpacity.set(1);
          }
        }}
        initial={false}
        animate={{ x: isOpen ? "0%" : "100%" }}
        transition={spring.snappy}
        style={{ pointerEvents: isOpen ? "auto" : "none" }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cc-border px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-cc-primary" strokeWidth={1.9} />
            <h2 className="text-[16px] font-bold text-cc-text">
              Tu carrito
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
            aria-label="Cerrar carrito"
            className="cc-focus-ring grid h-8 w-8 place-items-center rounded-cc-sm text-cc-muted transition-colors duration-[140ms] hover:bg-cc-bg-surface-soft hover:text-cc-text"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* Items — scrollable */}
        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <EmptyCart onExplore={close} />
          ) : (
            <div>
              <AnimatePresence initial={false}>
                {items.map((item) => (
                  <motion.div
                    key={item.product.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={spring.gentle}
                    style={{ overflow: "hidden" }}
                  >
                    <CartItem item={item} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer — only when has items */}
        {items.length > 0 && <CartSummary />}
      </motion.div>
    </>
  );
}

/** Empty state with a very subtle mouse-follow parallax on the icon. */
function EmptyCart({ onExplore }: { onExplore: () => void }) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, spring.gentle);
  const y = useSpring(rawY, spring.gentle);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    rawX.set(((e.clientX - rect.left) / rect.width - 0.5) * 10);
    rawY.set(((e.clientY - rect.top) / rect.height - 0.5) * 10);
  }
  function handleLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <div
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center"
    >
      <motion.div
        style={{ x, y }}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-cc-bg-surface-soft"
      >
        <ShoppingCart className="h-8 w-8 text-cc-muted" strokeWidth={1.5} />
      </motion.div>
      <p className="text-[15px] font-semibold text-cc-text">Tu carrito está vacío</p>
      <p className="text-[13px] text-cc-muted max-w-[200px]">
        Agrega productos para comenzar tu compra
      </p>
      <button
        type="button"
        onClick={onExplore}
        className="mt-2 rounded-[11px] bg-cc-primary px-6 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
      >
        Explorar catálogo
      </button>
    </div>
  );
}
