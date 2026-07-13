"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { CheckCircle2, Clock, Truck, XCircle } from "lucide-react";
import type { OrderStatus } from "@/lib/account-types";
import { formatOrderDate, mapOrderStatus } from "@/lib/api/orders";
import { useMyOrders } from "@/hooks/use-my-orders";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer } from "@/lib/motion";

const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    iconBackground: string;
    iconColor: string;
    badgeBackground: string;
    badgeColor: string;
    Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }
> = {
  "in-transit": {
    label: "En tránsito",
    iconBackground: "bg-cc-primary-soft",
    iconColor: "text-cc-primary",
    badgeBackground: "bg-cc-primary-soft",
    badgeColor: "text-cc-primary",
    Icon: Truck,
  },
  preparing: {
    label: "Preparando",
    iconBackground: "bg-cc-warning-soft",
    iconColor: "text-cc-text",
    badgeBackground: "bg-cc-warning-soft",
    badgeColor: "text-cc-text",
    Icon: Clock,
  },
  delivered: {
    label: "Entregado",
    iconBackground: "bg-cc-success-soft",
    iconColor: "text-cc-success",
    badgeBackground: "bg-cc-success-soft",
    badgeColor: "text-cc-success",
    Icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    iconBackground: "bg-cc-border-subtle",
    iconColor: "text-cc-muted",
    badgeBackground: "bg-cc-border-subtle",
    badgeColor: "text-cc-muted",
    Icon: XCircle,
  },
};

export function OrderStatusList() {
  const { orders, loading } = useMyOrders();
  const recent = orders.slice(0, 4);

  return (
    <div className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm">
      <h2 className="mb-4 text-[15px] font-bold text-cc-text">Estado de pedidos</h2>
      {loading ? (
        <div className="space-y-3" aria-label="Cargando pedidos" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 py-1">
              <Skeleton variant="avatar" className="h-9 w-9" />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" className="w-3/5" />
                <Skeleton variant="text" className="h-3 w-2/5" />
              </div>
              <Skeleton variant="text" className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-cc-muted">Todavía no tenés pedidos.</p>
      ) : (
        <motion.ul
          variants={staggerContainer(0.03)}
          initial="hidden"
          animate="visible"
          className="flex flex-col divide-y divide-cc-border-subtle"
        >
          {recent.map((order) => {
            const config = statusConfig[mapOrderStatus(order.status)];
            const Icon = config.Icon;
            return (
              <motion.li
                key={order.id}
                variants={{ hidden: { opacity: 0, transform: "translateY(6px)" }, visible: { opacity: 1, transform: "translateY(0px)" } }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href={`/orders/${order.id}`}
                  className="-mx-2 flex min-h-16 items-center gap-3 rounded-cc-sm px-2 py-3 transition-[background-color] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-softer"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.iconBackground} ${config.iconColor}`}>
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-cc-text">
                      Pedido #{order.orderNumber}
                      <span className="font-normal text-cc-muted"> · {order.itemCount} {order.itemCount === 1 ? "producto" : "productos"}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-cc-muted">{formatOrderDate(order.createdAt)}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${config.badgeBackground} ${config.badgeColor}`}>
                    {config.label}
                  </span>
                </Link>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
      <Link href="/orders" className="cc-focus-ring mt-3 block text-center text-[13px] font-semibold text-cc-primary hover:underline">
        Ver todos los pedidos
      </Link>
    </div>
  );
}
