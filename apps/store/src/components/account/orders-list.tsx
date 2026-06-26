"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Truck, Clock, CheckCircle2, XCircle } from "lucide-react";
import { mockOrders, type OrderStatus } from "@/lib/mock-account";
import { formatCOP } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
import { useOrders } from "@/store/orders";

type Filter = "all" | OrderStatus;

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "in-transit", label: "En tránsito" },
  { id: "preparing", label: "Preparando" },
  { id: "delivered", label: "Entregados" },
  { id: "cancelled", label: "Cancelados" },
];

const statusConfig: Record<
  OrderStatus,
  { label: string; bgBadge: string; textBadge: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  "in-transit": { label: "En tránsito", bgBadge: "bg-[#EAF3FF]", textBadge: "text-cc-primary", Icon: Truck },
  preparing: { label: "Preparando", bgBadge: "bg-[#FFF7E6]", textBadge: "text-[#B45309]", Icon: Clock },
  delivered: { label: "Entregado", bgBadge: "bg-cc-success-soft", textBadge: "text-cc-success", Icon: CheckCircle2 },
  cancelled: { label: "Cancelado", bgBadge: "bg-cc-border-subtle", textBadge: "text-cc-muted", Icon: XCircle },
};

export function OrdersList() {
  const [filter, setFilter] = useState<Filter>("all");
  const hydrated = useHydrated();
  const placedOrders = useOrders((s) => s.placedOrders);

  // Show client-placed orders first, then the mock history (after hydration to
  // avoid an SSR/CSR mismatch on the persisted list).
  const allOrders = hydrated ? [...placedOrders, ...mockOrders] : mockOrders;
  const visible =
    filter === "all" ? allOrders : allOrders.filter((o) => o.status === filter);

  return (
    <div>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={[
              "px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-[140ms] ease-cc-out border cc-focus-ring",
              filter === f.id
                ? "bg-cc-primary text-white border-cc-primary shadow-sm"
                : "bg-cc-shell text-cc-secondary border-cc-border hover:border-cc-primary-border hover:text-cc-primary",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="flex flex-col gap-3">
        {visible.length === 0 && (
          <p className="text-center py-12 text-cc-muted text-[14px]">
            No hay pedidos con ese filtro.
          </p>
        )}
        {visible.map((order) => {
          const cfg = statusConfig[order.status];
          const { Icon } = cfg;
          const first = order.items[0];
          return (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 flex items-center gap-4 hover:shadow-cc-md hover:-translate-y-px transition-all duration-[220ms] ease-cc-out"
            >
              {/* Thumbnail */}
              <div className="h-14 w-14 shrink-0 rounded-cc-xs bg-cc-bg-surface-soft flex items-center justify-center overflow-hidden">
                <Image
                  src={first.image}
                  alt={first.name}
                  width={52}
                  height={52}
                  className="object-contain"
                />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-cc-text truncate">
                  {first.name}
                  {order.items.length > 1 && (
                    <span className="text-cc-muted font-normal">
                      {" "}+{order.items.length - 1} productos
                    </span>
                  )}
                </p>
                <p className="text-[12px] text-cc-muted mt-0.5">
                  #{order.id} · {order.date}
                  {order.eta && ` · ETA ${order.eta}`}
                </p>
              </div>

              {/* Right side */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <p className="text-[14px] font-black text-cc-text">
                  {formatCOP(order.total)}
                </p>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bgBadge} ${cfg.textBadge}`}
                >
                  <Icon className="h-3 w-3" strokeWidth={2} />
                  {cfg.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
