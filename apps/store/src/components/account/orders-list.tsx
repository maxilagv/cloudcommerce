"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, ChevronDown, Clock, Package, Truck, XCircle } from "lucide-react";
import type { OrderStatus } from "@/lib/account-types";
import { fetchMyOrders, mapSummaryToListEntry, type OrderListEntry } from "@/lib/api/orders";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { spring } from "@/lib/motion";

type Filter = "all" | OrderStatus;
const filters: { id: Filter; label: string }[] = [{ id: "all", label: "Todos" }, { id: "in-transit", label: "En tránsito" }, { id: "preparing", label: "Preparando" }, { id: "delivered", label: "Entregados" }, { id: "cancelled", label: "Cancelados" }];
const statusConfig: Record<OrderStatus, { label: string; bg: string; text: string; dot: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  "in-transit": { label: "En tránsito", bg: "bg-cc-primary-soft", text: "text-cc-primary", dot: "bg-cc-primary", Icon: Truck },
  preparing: { label: "Preparando", bg: "bg-cc-warning-soft", text: "text-cc-text", dot: "bg-cc-warning", Icon: Clock },
  delivered: { label: "Entregado", bg: "bg-cc-success-soft", text: "text-cc-success", dot: "bg-cc-success", Icon: CheckCircle2 },
  cancelled: { label: "Cancelado", bg: "bg-cc-border-subtle", text: "text-cc-muted", dot: "bg-cc-muted", Icon: XCircle },
};

function OrderSkeleton() {
  return <div className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-4 shadow-cc-sm"><div className="flex items-center gap-4"><Skeleton variant="image" className="h-14 w-14" /><div className="flex-1 space-y-2"><Skeleton variant="text" className="w-2/5" /><Skeleton variant="text" className="h-3 w-3/5" /></div><div className="space-y-2"><Skeleton variant="text" className="w-16" /><Skeleton variant="text" className="h-5 w-20 rounded-full" /></div></div></div>;
}

export function OrdersList() {
  const [filter, setFilter] = useState<Filter>("all");
  const [orders, setOrders] = useState<OrderListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { let cancelled = false; void fetchMyOrders().then((summaries) => { if (cancelled) return; setOrders(summaries.map(mapSummaryToListEntry)); setLoading(false); }); return () => { cancelled = true; }; }, []);
  const visible = useMemo(() => filter === "all" ? orders : orders.filter((order) => order.status === filter), [filter, orders]);

  return <div>
    <div className="mb-5 flex flex-wrap gap-2" aria-label="Filtrar pedidos">
      {filters.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`cc-focus-ring min-h-11 rounded-full border px-3.5 text-[13px] font-medium transition-[background-color,color,border-color] duration-[var(--cc-duration-fast)] ease-cc-out ${filter === item.id ? "border-cc-primary bg-cc-primary text-cc-shell" : "border-cc-border bg-cc-shell text-cc-secondary hover:border-cc-primary-border hover:text-cc-primary"}`}>{item.label}</button>)}
    </div>
    <div className="flex flex-col gap-3">
      {loading && Array.from({ length: 3 }, (_, index) => <OrderSkeleton key={index} />)}
      {!loading && visible.length === 0 && <p className="py-12 text-center text-[14px] text-cc-muted">{orders.length === 0 ? "Todavía no realizaste ningún pedido." : "No hay pedidos con ese filtro."}</p>}
      {!loading && visible.map((order) => {
        const config = statusConfig[order.status];
        const Icon = config.Icon;
        const expanded = expandedId === order.id;
        return <motion.article key={order.id} layout transition={spring.gentle} className="overflow-hidden rounded-cc-xl border border-cc-border-subtle bg-cc-shell shadow-cc-sm transition-[transform,box-shadow] duration-[var(--cc-duration-normal)] ease-cc-out hover:-translate-y-[2px] hover:shadow-cc-md">
          <div className="flex items-center gap-4 p-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-cc-xs bg-cc-soft"><Package className="h-6 w-6 text-cc-primary" strokeWidth={1.75} /></span>
            <Link href={`/orders/${order.id}`} className="cc-focus-ring min-w-0 flex-1 rounded-cc-xs"><p className="font-mono text-[13px] font-semibold tabular-nums text-cc-text">Pedido #{order.orderNumber}</p><p className="mt-0.5 truncate text-[12px] text-cc-muted">{order.date} · {order.address}</p></Link>
            <div className="flex shrink-0 flex-col items-end gap-1.5"><p className="text-[14px] font-black tabular-nums text-cc-text">{formatPrice(order.total)}</p><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.bg} ${config.text}`}><span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} /><Icon className="h-3 w-3" strokeWidth={1.75} />{config.label}</span></div>
            <button type="button" onClick={() => setExpandedId(expanded ? null : order.id)} aria-expanded={expanded} aria-label={`${expanded ? "Ocultar" : "Mostrar"} productos del pedido ${order.orderNumber}`} className="cc-focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-full text-cc-muted transition-[background-color,transform] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-softer hover:text-cc-primary"><ChevronDown className={`h-4 w-4 transition-transform duration-[var(--cc-duration-fast)] ease-cc-out ${expanded ? "rotate-180" : ""}`} strokeWidth={2} /></button>
          </div>
          <AnimatePresence initial={false}>{expanded && <motion.div key="details" layout="position" initial={{ opacity: 0, transform: "translateY(-4px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0, transform: "translateY(-4px)" }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} className="border-t border-cc-border-subtle bg-cc-soft/50 px-4 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-cc-xs bg-cc-shell"><Package className="h-4 w-4 text-cc-primary" strokeWidth={1.75} /></span><p className="min-w-0 flex-1 truncate text-[12px] font-medium text-cc-secondary">{order.items[0]?.name}</p><span className="text-[12px] font-semibold text-cc-text">{order.itemCount} {order.itemCount === 1 ? "unidad" : "unidades"}</span></div><Link href={`/orders/${order.id}`} className="cc-focus-ring mt-3 inline-flex text-[12px] font-bold text-cc-primary hover:underline">Ver detalle del pedido</Link></motion.div>}</AnimatePresence>
        </motion.article>;
      })}
    </div>
  </div>;
}
