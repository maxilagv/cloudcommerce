"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, CheckCircle2, ChevronLeft, Clock, CreditCard, MapPin, Package, Truck, XCircle } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/account-types";
import { spring } from "@/lib/motion";

const statusConfig: Record<OrderStatus, { label: string; copy: string; bg: string; text: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }> = {
  "in-transit": { label: "En tránsito", copy: "Tu pedido está en camino", bg: "bg-cc-primary-soft", text: "text-cc-primary", Icon: Truck },
  preparing: { label: "Preparando", copy: "Estamos preparando tu pedido", bg: "bg-cc-warning-soft", text: "text-cc-text", Icon: Clock },
  delivered: { label: "Entregado", copy: "Tu pedido fue entregado", bg: "bg-cc-success-soft", text: "text-cc-success", Icon: CheckCircle2 },
  cancelled: { label: "Cancelado", copy: "Este pedido fue cancelado", bg: "bg-cc-border-subtle", text: "text-cc-muted", Icon: XCircle },
};
const checkpoints = ["Pedido confirmado", "Pago confirmado", "Preparación", "Enviado", "En camino", "Entregado"];
const statusIndex: Record<Exclude<OrderStatus, "cancelled">, number> = { preparing: 2, "in-transit": 4, delivered: 5 };

function OrderTimeline({ status }: { status: Exclude<OrderStatus, "cancelled"> }) {
  const activeIndex = statusIndex[status];
  const progress = checkpoints.length > 1 ? activeIndex / (checkpoints.length - 1) : 0;
  return <section id="seguimiento" className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm" aria-labelledby="tracking-title"><h2 id="tracking-title" className="mb-6 text-[15px] font-bold text-cc-text">Seguimiento</h2>
    <div className="relative md:hidden"><div className="absolute bottom-5 left-[13px] top-5 w-0.5 bg-cc-border-subtle" /><motion.div initial={{ transform: "scaleY(0)" }} animate={{ transform: `scaleY(${progress})` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="absolute bottom-5 left-[13px] top-5 w-0.5 origin-top bg-cc-primary" />{checkpoints.map((checkpoint, index) => <TimelinePoint key={checkpoint} index={index} activeIndex={activeIndex} label={checkpoint} />)}</div>
    <div className="relative hidden md:block"><div className="absolute left-5 right-5 top-[13px] h-0.5 bg-cc-border-subtle" /><motion.div initial={{ transform: "scaleX(0)" }} animate={{ transform: `scaleX(${progress})` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="absolute left-5 right-5 top-[13px] h-0.5 origin-left bg-cc-primary" /><div className="grid grid-cols-6 gap-2">{checkpoints.map((checkpoint, index) => <TimelinePoint key={checkpoint} index={index} activeIndex={activeIndex} label={checkpoint} desktop />)}</div></div>
  </section>;
}
function TimelinePoint({ index, activeIndex, label, desktop = false }: { index: number; activeIndex: number; label: string; desktop?: boolean }) {
  const complete = index < activeIndex;
  const current = index === activeIndex;
  return <motion.div initial={{ opacity: 0, transform: "scale(0.9)" }} animate={{ opacity: 1, transform: "scale(1)" }} transition={{ ...spring.snappy, delay: index * 0.1 }} className={desktop ? "relative flex flex-col items-center text-center" : "relative flex min-h-11 items-center gap-3 pb-4 last:pb-0"}><span className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${complete ? "bg-cc-primary text-cc-shell" : current ? "bg-cc-primary text-cc-shell" : "bg-cc-border-subtle text-cc-faint"}`}>{complete ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : <Package className="h-3.5 w-3.5" strokeWidth={1.75} />}{current && <motion.span aria-hidden="true" initial={{ opacity: 0.45, transform: "scale(1)" }} animate={{ opacity: [0.45, 0, 0.45], transform: ["scale(1)", "scale(1.8)", "scale(1)"] }} transition={{ duration: 2, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0 rounded-full border border-cc-primary" />}</span><span className={`text-[11px] font-semibold ${complete || current ? "text-cc-text" : "text-cc-faint"}`}>{label}</span></motion.div>;
}

export function OrderDetail({ order }: { order: Order & { orderNumber?: string } }) {
  const config = statusConfig[order.status];
  const Icon = config.Icon;
  const displayNumber = order.orderNumber ?? order.id;
  return <div className="flex flex-col gap-6"><div><Link href="/orders" className="cc-focus-ring mb-3 inline-flex min-h-11 items-center gap-1 text-[13px] text-cc-muted transition-colors duration-[var(--cc-duration-fast)] ease-cc-out hover:text-cc-primary"><ChevronLeft className="h-4 w-4" strokeWidth={1.75} />Volver a mis pedidos</Link><div className="flex flex-wrap items-center gap-3"><h1 className="font-mono text-[22px] font-bold tabular-nums text-cc-text">Pedido #{displayNumber}</h1><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${config.bg} ${config.text}`}><Icon className="h-4 w-4" strokeWidth={1.75} />{config.label}</span></div><p className="mt-1 text-[14px] font-medium text-cc-secondary">{config.copy}</p><p className="mt-1 text-[13px] text-cc-muted">Realizado el {order.date}{order.eta && ` · Entrega estimada: ${order.eta}`}</p></div>
    {order.status !== "cancelled" && <><OrderTimeline status={order.status} /><a href="#seguimiento" className="cc-focus-ring inline-flex min-h-11 w-fit items-center justify-center rounded-cc-sm bg-cc-primary px-5 text-[13px] font-bold text-cc-shell transition-[background-color,transform] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-hover active:scale-[0.98]">Seguir envío</a></>}
    <section className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm"><h2 className="mb-4 text-[14px] font-bold text-cc-text">Productos</h2><ul className="flex flex-col divide-y divide-cc-border-subtle">{order.items.map((item) => <li key={item.productId} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-cc-xs bg-cc-soft"><Image src={item.image} alt={item.name} width={56} height={56} className="object-contain" /></span><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold leading-snug text-cc-text">{item.name}</span><span className="mt-0.5 block text-[13px] text-cc-muted">Cantidad: {item.qty}</span></span><span className="shrink-0 text-[14px] font-bold tabular-nums text-cc-text">{formatPrice(item.price * item.qty)}</span></li>)}</ul><div className="mt-4 flex flex-col gap-2 border-t border-cc-border-subtle pt-4"><div className="flex justify-between text-[13px] text-cc-secondary"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>{order.discount > 0 && <div className="flex justify-between text-[13px] text-cc-success"><span>Descuento</span><span>-{formatPrice(order.discount)}</span></div>}<div className="flex justify-between text-[13px] text-cc-secondary"><span>Envío</span><span className={order.shipping === 0 ? "font-medium text-cc-success" : ""}>{order.shipping === 0 ? "Gratis" : formatPrice(order.shipping)}</span></div><div className="mt-1 flex justify-between border-t border-cc-border-subtle pt-2 text-[16px] font-black text-cc-text"><span>Total</span><span className="tabular-nums">{formatPrice(order.total)}</span></div></div></section>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><section className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-4 shadow-cc-sm"><div className="mb-2 flex items-center gap-2"><MapPin className="h-4 w-4 text-cc-primary" strokeWidth={1.75} /><h2 className="text-[13px] font-bold text-cc-text">Entrega</h2></div><p className="text-[13px] text-cc-secondary">{order.address}</p></section><section className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-4 shadow-cc-sm"><div className="mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4 text-cc-primary" strokeWidth={1.75} /><h2 className="text-[13px] font-bold text-cc-text">Método de pago</h2></div><p className="text-[13px] text-cc-secondary">{order.paymentLast4 ? `Tarjeta terminada en ${order.paymentLast4}` : "Pago a coordinar con el vendedor"}</p></section></div>
  </div>;
}
