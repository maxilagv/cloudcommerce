"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { PackageCheck } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { formatOrderDate, mapOrderStatus } from "@/lib/api/orders";
import { useMyOrders } from "@/hooks/use-my-orders";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer } from "@/lib/motion";

export function RecentPurchases() {
  const { orders, loading } = useMyOrders();
  const delivered = orders.filter((order) => mapOrderStatus(order.status) === "delivered").slice(0, 4);

  return (
    <div className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm">
      <h2 className="mb-4 text-[15px] font-bold text-cc-text">Últimas compras</h2>
      {loading ? (
        <div className="space-y-3" aria-label="Cargando compras" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 py-1">
              <Skeleton variant="image" className="h-12 w-12" />
              <div className="flex-1 space-y-2"><Skeleton variant="text" className="w-3/4" /><Skeleton variant="text" className="h-3 w-1/3" /></div>
              <Skeleton variant="text" className="w-14" />
            </div>
          ))}
        </div>
      ) : delivered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-cc-muted">Todavía no hay compras entregadas.</p>
      ) : (
        <motion.ul variants={staggerContainer(0.03)} initial="hidden" animate="visible" className="flex flex-col divide-y divide-cc-border-subtle">
          {delivered.map((order) => (
            <motion.li key={order.id} variants={{ hidden: { opacity: 0, transform: "translateY(6px)" }, visible: { opacity: 1, transform: "translateY(0px)" } }} transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}>
              <Link href={`/orders/${order.id}`} className="-mx-2 flex min-h-18 items-center gap-3 rounded-cc-sm px-2 py-3 transition-[background-color] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-softer">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-cc-xs bg-cc-soft"><PackageCheck className="h-5 w-5 text-cc-success" strokeWidth={1.75} /></span>
                <span className="min-w-0 flex-1"><span className="cc-line-clamp-2 block text-[13px] font-medium leading-snug text-cc-text">Pedido #{order.orderNumber} · {order.itemCount} {order.itemCount === 1 ? "producto" : "productos"}</span><span className="mt-0.5 block text-[11px] text-cc-muted">{formatOrderDate(order.createdAt)}</span></span>
                <span className="shrink-0 text-[13px] font-bold text-cc-text">{formatPrice(Math.round(order.total.amountMinor / 100))}</span>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </div>
  );
}
