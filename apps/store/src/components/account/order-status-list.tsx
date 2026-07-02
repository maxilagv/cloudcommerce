import Link from "next/link";
import { Truck, Clock, CheckCircle2, XCircle } from "lucide-react";
import { mockOrders, type OrderStatus } from "@/lib/mock-account";

const statusConfig: Record<
  OrderStatus,
  { label: string; bgIcon: string; textIcon: string; bgBadge: string; textBadge: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  "in-transit": {
    label: "En tránsito",
    bgIcon: "bg-[#EAF3FF]",
    textIcon: "text-cc-primary",
    bgBadge: "bg-[#EAF3FF]",
    textBadge: "text-cc-primary",
    Icon: Truck,
  },
  preparing: {
    label: "Preparando",
    bgIcon: "bg-[#FFF7E6]",
    textIcon: "text-[#B45309]",
    bgBadge: "bg-[#FFF7E6]",
    textBadge: "text-[#B45309]",
    Icon: Clock,
  },
  delivered: {
    label: "Entregado",
    bgIcon: "bg-cc-success-soft",
    textIcon: "text-cc-success",
    bgBadge: "bg-cc-success-soft",
    textBadge: "text-cc-success",
    Icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    bgIcon: "bg-cc-border-subtle",
    textIcon: "text-cc-muted",
    bgBadge: "bg-cc-border-subtle",
    textBadge: "text-cc-muted",
    Icon: XCircle,
  },
};

export function OrderStatusList() {
  const recent = mockOrders.slice(0, 4);

  return (
    <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-5">
      <h2 className="text-[15px] font-bold text-cc-text mb-4">Estado de pedidos</h2>
      <ul className="flex flex-col divide-y divide-cc-border-subtle">
        {recent.map((order) => {
          const cfg = statusConfig[order.status];
          const { Icon } = cfg;
          const firstItem = order.items[0];
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center gap-3 py-3 hover:bg-cc-bg-hover rounded-cc-sm px-2 -mx-2 transition-colors duration-[140ms] ease-cc-out group"
              >
                <span
                  className={`h-9 w-9 rounded-full ${cfg.bgIcon} ${cfg.textIcon} flex items-center justify-center shrink-0`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-cc-text truncate">
                    {firstItem.name}
                    {order.items.length > 1 && (
                      <span className="text-cc-muted font-normal">
                        {" "}+{order.items.length - 1} más
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-cc-muted mt-0.5">
                    #{order.id} · {order.eta ? `ETA ${order.eta}` : order.date}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full ${cfg.bgBadge} ${cfg.textBadge}`}
                >
                  {cfg.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        href="/orders"
        className="mt-3 block text-center text-[13px] font-semibold text-cc-primary hover:underline"
      >
        Ver todos los pedidos →
      </Link>
    </div>
  );
}
