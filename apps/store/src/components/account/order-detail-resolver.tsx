"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Order } from "@/lib/account-types";
import { fetchOrderDetail, mapDetailToOrder } from "@/lib/api/orders";
import { OrderDetail } from "./order-detail";

type State =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "ready"; order: Order & { orderNumber: string } };

/**
 * Resolves an order from the backend (storefront.orderDetail) client-side —
 * this runs behind AuthGuard so the customer session cookie is present.
 */
export function OrderDetailResolver({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void fetchOrderDetail(id).then((detail) => {
      if (cancelled) return;
      setState(detail ? { status: "ready", order: mapDetailToOrder(detail) } : { status: "not-found" });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-cc-muted" />
      </div>
    );
  }

  if (state.status === "not-found") {
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

  return <OrderDetail order={state.order} />;
}
