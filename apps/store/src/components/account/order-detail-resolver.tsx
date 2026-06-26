"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";
import { useOrders } from "@/store/orders";
import { OrderDetail } from "./order-detail";

/**
 * Resolves an order from placed (client) ∪ mock orders. Client-side so freshly
 * placed orders are viewable; gated on hydration to avoid SSR/CSR mismatch.
 */
export function OrderDetailResolver({ id }: { id: string }) {
  const hydrated = useHydrated();
  const getById = useOrders((s) => s.getById);

  if (!hydrated) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-cc-muted" />
      </div>
    );
  }

  const order = getById(id);

  if (!order) {
    return (
      <div className="py-20 text-center">
        <p className="text-[16px] font-semibold text-cc-text">Pedido no encontrado</p>
        <p className="mt-1 text-[13px] text-cc-muted">
          Puede que el enlace haya expirado o el pedido no exista.
        </p>
        <Link
          href="/orders"
          className="mt-4 inline-block rounded-[11px] bg-cc-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
        >
          Volver a mis pedidos
        </Link>
      </div>
    );
  }

  return <OrderDetail order={order} />;
}
