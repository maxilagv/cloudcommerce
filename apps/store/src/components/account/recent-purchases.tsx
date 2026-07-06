"use client";

import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { formatOrderDate, mapOrderStatus } from "@/lib/api/orders";
import { useMyOrders } from "@/hooks/use-my-orders";

export function RecentPurchases() {
  const { orders } = useMyOrders();
  const delivered = orders
    .filter((o) => mapOrderStatus(o.status) === "delivered")
    .slice(0, 4);

  return (
    <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-5">
      <h2 className="text-[15px] font-bold text-cc-text mb-4">Últimas compras</h2>
      {delivered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-cc-muted">
          Todavía no hay compras entregadas.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-cc-border-subtle">
          {delivered.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center gap-3 py-3 hover:bg-cc-bg-hover rounded-cc-sm px-2 -mx-2 transition-colors duration-[140ms] ease-cc-out"
              >
                <div className="h-12 w-12 shrink-0 rounded-cc-xs bg-cc-bg-surface-soft flex items-center justify-center">
                  <PackageCheck className="h-5 w-5 text-cc-success" strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-cc-text leading-snug cc-line-clamp-2">
                    Pedido #{order.orderNumber} · {order.itemCount}{" "}
                    {order.itemCount === 1 ? "producto" : "productos"}
                  </p>
                  <p className="text-[11px] text-cc-muted mt-0.5">
                    {formatOrderDate(order.createdAt)}
                  </p>
                </div>
                <p className="text-[13px] font-bold text-cc-text shrink-0">
                  {formatPrice(Math.round(order.total.amountMinor / 100))}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
