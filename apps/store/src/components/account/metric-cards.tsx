"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { ShoppingBag, Package, Truck, CheckCircle2 } from "lucide-react";
import { useMyOrders } from "@/hooks/use-my-orders";
import { mapOrderStatus } from "@/lib/api/orders";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer } from "@/lib/motion";
import { useCountUp } from "./hooks/use-count-up";

function MetricValue({ value, currency = false }: { value: number; currency?: boolean }) {
  const count = useCountUp(value);
  return <>{currency ? formatPrice(count) : count.toLocaleString("es-AR")}</>;
}

export function MetricCards() {
  const { orders, loading } = useMyOrders();

  const metrics = useMemo(() => {
    const active = orders.filter((order) => mapOrderStatus(order.status) !== "cancelled");
    const totalSpent = active.reduce(
      (total, order) => total + Math.round(order.total.amountMinor / 100),
      0,
    );
    const inProgress = orders.filter((order) => mapOrderStatus(order.status) === "preparing").length;
    const inTransit = orders.filter((order) => mapOrderStatus(order.status) === "in-transit").length;
    const delivered = orders.filter((order) => mapOrderStatus(order.status) === "delivered").length;

    return [
      { label: "Total gastado", value: totalSpent, icon: ShoppingBag, currency: true },
      { label: "Compras realizadas", value: active.length, icon: Package },
      { label: "Pedidos en curso", value: inProgress + inTransit, icon: Truck },
      { label: "Entregados", value: delivered, icon: CheckCircle2 },
    ];
  }, [orders]);

  return (
    <motion.div
      variants={staggerContainer(0.04)}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            variants={{
              hidden: { opacity: 0, transform: "translateY(8px) scale(0.98)" },
              visible: { opacity: 1, transform: "translateY(0px) scale(1)" },
            }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-4 shadow-cc-sm transition-[transform,box-shadow] duration-[var(--cc-duration-normal)] ease-cc-out hover:-translate-y-[2px] hover:shadow-cc-md"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-medium leading-snug text-cc-muted">{metric.label}</p>
              <motion.span
                initial={{ opacity: 0, transform: "scale(0.9)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-cc-sm bg-cc-primary-soft"
              >
                <Icon className="h-3.5 w-3.5 text-cc-primary" strokeWidth={1.75} />
              </motion.span>
            </div>
            <p className="mt-2 text-[22px] font-black leading-tight tracking-tight text-cc-text tabular-nums">
              {loading ? (
                <Skeleton variant="text" className="w-20" />
              ) : (
                <MetricValue value={metric.value} currency={metric.currency} />
              )}
            </p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
