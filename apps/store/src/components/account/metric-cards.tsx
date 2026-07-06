"use client";

import { useMemo } from "react";
import { ShoppingBag, Package, Truck, CheckCircle2 } from "lucide-react";
import { useMyOrders } from "@/hooks/use-my-orders";
import { mapOrderStatus } from "@/lib/api/orders";
import { formatPrice } from "@/lib/utils";

export function MetricCards() {
  const { orders } = useMyOrders();

  const metrics = useMemo(() => {
    const active = orders.filter((o) => mapOrderStatus(o.status) !== "cancelled");
    const totalSpent = active.reduce((acc, o) => acc + Math.round(o.total.amountMinor / 100), 0);
    const inProgress = orders.filter((o) => mapOrderStatus(o.status) === "preparing").length;
    const inTransit = orders.filter((o) => mapOrderStatus(o.status) === "in-transit").length;
    const delivered = orders.filter((o) => mapOrderStatus(o.status) === "delivered").length;
    return [
      { label: "Total gastado", value: formatPrice(totalSpent), icon: ShoppingBag },
      { label: "Compras realizadas", value: String(active.length), icon: Package },
      { label: "Pedidos en curso", value: String(inProgress + inTransit), icon: Truck },
      { label: "Entregados", value: String(delivered), icon: CheckCircle2 },
    ];
  }, [orders]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 hover:shadow-cc-md hover:-translate-y-px transition-all duration-[220ms] ease-cc-out"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-medium text-cc-muted leading-snug">
                {m.label}
              </p>
              <span className="h-7 w-7 rounded-cc-sm bg-cc-primary-soft flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-cc-primary" strokeWidth={1.8} />
              </span>
            </div>
            <p className="text-[22px] font-black text-cc-text leading-tight mt-2 tracking-tight">
              {m.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
