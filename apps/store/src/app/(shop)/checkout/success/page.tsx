"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Package, Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
import { useOrders } from "@/store/orders";
import { fetchOrderDetail, mapDetailToOrder } from "@/lib/api/orders";

type SuccessOrder = {
  id: string;
  orderNumber: string;
  total: number;
  eta?: string;
};

export default function CheckoutSuccessPage() {
  const hydrated = useHydrated();
  const lastOrderId = useOrders((s) => s.lastOrderId);
  const [order, setOrder] = useState<SuccessOrder | null>(null);

  useEffect(() => {
    if (!hydrated || !lastOrderId) return;
    let cancelled = false;
    void fetchOrderDetail(lastOrderId).then((detail) => {
      if (cancelled || !detail) return;
      const mapped = mapDetailToOrder(detail);
      setOrder({
        id: mapped.id,
        orderNumber: mapped.orderNumber,
        total: mapped.total,
        eta: mapped.eta,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, lastOrderId]);

  if (!hydrated) {
    return <div className="mx-auto max-w-[640px] px-4 py-24" />;
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 py-16 text-center sm:px-6">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cc-success-soft animate-[cc-badge-pop_360ms_ease-cc-spring]">
        <CheckCircle2 className="h-11 w-11 text-cc-success" strokeWidth={1.8} />
      </div>
      <h1 className="mt-5 text-[24px] font-extrabold tracking-tight text-cc-text">
        ¡Gracias por tu compra!
      </h1>
      <p className="mt-2 text-[14px] text-cc-muted">
        Recibimos tu pedido y nos vamos a contactar para coordinar el pago y la entrega.
      </p>

      {order && (
        <div className="mt-8 rounded-cc-lg border border-cc-border bg-white p-5 text-left">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-cc-muted">Número de pedido</span>
            <span className="text-[14px] font-bold text-cc-text">#{order.orderNumber}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[13px] text-cc-muted">Total</span>
            <span className="text-[15px] font-extrabold tracking-tight text-cc-text">
              {formatPrice(order.total)}
            </span>
          </div>
          {order.eta && (
            <div className="mt-3 flex items-center gap-2 rounded-cc-sm bg-cc-soft px-3 py-2.5 text-[13px] text-cc-text">
              <Truck className="h-4 w-4 text-cc-primary" strokeWidth={1.9} />
              Entrega estimada: <span className="font-semibold">{order.eta}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href={lastOrderId ? `/orders/${lastOrderId}` : "/orders"}
          className="flex items-center justify-center gap-2 rounded-[11px] bg-cc-primary px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
        >
          <Package className="h-[18px] w-[18px]" strokeWidth={2} />
          Ver mi pedido
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center rounded-[11px] border border-cc-border bg-white px-6 py-3 text-[14px] font-semibold text-cc-text transition-colors hover:border-cc-primary-border hover:text-cc-primary"
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
