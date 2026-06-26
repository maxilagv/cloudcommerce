"use client";

import { ShoppingCart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart, useCartCount } from "@/store/cart";
import { CartItem } from "./item";
import { CartSummary } from "./summary";

export function CartDrawer() {
  const isOpen = useCart((s) => s.isOpen);
  const close = useCart((s) => s.close);
  const items = useCart((s) => s.items);
  const count = useCartCount();

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-200",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-white shadow-2xl",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
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
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cc-bg-surface-soft">
                <ShoppingCart className="h-8 w-8 text-cc-muted" strokeWidth={1.5} />
              </div>
              <p className="text-[15px] font-semibold text-cc-text">
                Tu carrito está vacío
              </p>
              <p className="text-[13px] text-cc-muted max-w-[200px]">
                Agrega productos para comenzar tu compra
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
              {items.map((item) => (
                <CartItem key={item.product.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Footer — only when has items */}
        {items.length > 0 && <CartSummary />}
      </div>
    </>
  );
}
