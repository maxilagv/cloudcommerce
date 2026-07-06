"use client";

import Link from "next/link";
import { ArrowLeft, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
import { useCart, useCartCount, useCartTotal } from "@/store/cart";
import { CartItem } from "@/components/cart/item";

export default function CartPage() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const count = useCartCount();
  const total = useCartTotal();

  if (!hydrated) {
    return <div className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6" />;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-center gap-4 px-4 py-24 text-center sm:px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cc-soft">
          <ShoppingCart className="h-10 w-10 text-cc-muted" strokeWidth={1.4} />
        </div>
        <h1 className="text-[20px] font-bold text-cc-text">Tu carrito está vacío</h1>
        <p className="max-w-[280px] text-[14px] text-cc-muted">
          Explorá el catálogo y agregá productos para comenzar tu compra.
        </p>
        <Link
          href="/"
          className="mt-2 rounded-[11px] bg-cc-primary px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
        >
          Explorar catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold text-cc-text">
          Tu carrito{" "}
          <span className="text-[15px] font-medium text-cc-muted">
            ({count} {count === 1 ? "producto" : "productos"})
          </span>
        </h1>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[13px] font-medium text-cc-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Seguir comprando
        </Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Items */}
        <div className="rounded-cc-lg border border-cc-border bg-white px-5">
          {items.map((item) => (
            <CartItem key={item.product.id} item={item} />
          ))}
          <div className="flex justify-end py-4">
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1.5 text-[13px] font-medium text-cc-muted transition-colors hover:text-cc-danger"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.9} />
              Vaciar carrito
            </button>
          </div>
        </div>

        {/* Summary */}
        <aside className="h-fit rounded-cc-lg border border-cc-border bg-white p-5 lg:sticky lg:top-[84px]">
          <h2 className="text-[15px] font-bold text-cc-text">Resumen</h2>
          <div className="mt-4 space-y-2.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-cc-secondary">Subtotal</span>
              <span className="font-semibold text-cc-text">{formatPrice(total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-cc-secondary">Envío</span>
              <span className="font-semibold text-cc-success">Gratis</span>
            </div>
            <hr className="border-cc-border-subtle" />
            <div className="flex items-center justify-between text-[15px]">
              <span className="font-bold text-cc-text">Total</span>
              <span className="font-extrabold tracking-tight text-cc-text">
                {formatPrice(total)}
              </span>
            </div>
          </div>

          <Link
            href="/checkout"
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[11px] bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(11,107,255,0.24)] transition-[transform,filter] duration-[160ms] hover:-translate-y-px hover:brightness-[1.03]"
          >
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2} />
            Ir al pago
          </Link>
          <p className="mt-3 text-center text-[11px] text-cc-muted">
            Impuestos calculados en el pago
          </p>
        </aside>
      </div>
    </div>
  );
}
