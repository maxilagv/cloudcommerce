"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCart, useCartTotal } from "@/store/cart";

export function CartSummary() {
  const close = useCart((s) => s.close);
  const total = useCartTotal();

  return (
    <div className="space-y-3 border-t border-cc-border bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-cc-secondary">Subtotal</span>
        <span className="text-[15px] font-extrabold tracking-tight text-cc-text">
          {formatPrice(total)}
        </span>
      </div>
      <p className="text-[11px] text-cc-muted">
        Impuestos y envío calculados en el pago
      </p>
      <Link
        href="/checkout"
        onClick={close}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-[11px] bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(11,107,255,0.24)] transition-[transform,box-shadow,filter] duration-[160ms] hover:-translate-y-px hover:brightness-[1.03] hover:shadow-[0_14px_28px_rgba(11,107,255,0.32)] active:scale-[0.99]"
      >
        <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2} />
        Ir al pago
      </Link>
      <button
        type="button"
        onClick={close}
        className="w-full py-1 text-center text-[13px] font-medium text-cc-primary hover:underline"
      >
        Seguir comprando
      </button>
    </div>
  );
}
