"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useMyOrders } from "@/hooks/use-my-orders";
import { mapOrderStatus } from "@/lib/api/orders";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "./hooks/use-count-up";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const states = [
  { id: "delivered", label: "Entregados", color: "var(--cc-success)" },
  { id: "in-transit", label: "En camino", color: "var(--cc-primary)" },
  { id: "preparing", label: "Procesando", color: "var(--cc-warning)" },
  { id: "cancelled", label: "Cancelados", color: "var(--cc-danger)" },
] as const;

export function StatusDonut() {
  const { orders, loading } = useMyOrders();
  const [highlighted, setHighlighted] = useState<(typeof states)[number]["id"] | null>(null);
  const counts = useMemo(() => Object.fromEntries(states.map((state) => [state.id, orders.filter((order) => mapOrderStatus(order.status) === state.id).length])), [orders]);
  const total = orders.length;
  const displayTotal = useCountUp(total);
  let offset = 0;

  return (
    <section className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm" aria-labelledby="status-donut-title">
      <div className="mb-4"><p id="status-donut-title" className="text-[15px] font-bold text-cc-text">Estado de pedidos</p><p className="mt-0.5 text-[12px] text-cc-muted">Distribución de tus compras</p></div>
      {loading ? <div className="flex items-center gap-5"><Skeleton variant="avatar" className="h-32 w-32" /><div className="flex-1 space-y-3"><Skeleton variant="text" /><Skeleton variant="text" /><Skeleton variant="text" /></div></div> : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-36 w-36 shrink-0">
            <svg viewBox="0 0 112 112" className="h-full w-full -rotate-90" role="img" aria-label={`${total} pedidos en total`}>
              <circle cx="56" cy="56" r={RADIUS} fill="none" stroke="var(--cc-border-subtle)" strokeWidth="13" />
              {states.map((state, index) => {
                const count = counts[state.id];
                const length = total ? (count / total) * CIRCUMFERENCE : 0;
                const dashOffset = -offset;
                offset += length;
                return <motion.circle key={state.id} cx="56" cy="56" r={RADIUS} fill="none" stroke={state.color} strokeWidth="13" strokeLinecap="butt" strokeDasharray={`${length} ${CIRCUMFERENCE - length}`} initial={{ strokeDashoffset: CIRCUMFERENCE }} animate={{ strokeDashoffset: dashOffset, opacity: highlighted && highlighted !== state.id ? 0.4 : 1 }} transition={{ strokeDashoffset: { duration: 0.15, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }} />;
              })}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center"><span className="block text-[24px] font-black leading-none text-cc-text tabular-nums">{displayTotal}</span><span className="mt-1 block text-[11px] font-medium text-cc-muted">pedidos</span></div>
          </div>
          <ul className="grid flex-1 gap-2" onMouseLeave={() => setHighlighted(null)}>
            {states.map((state) => <li key={state.id}><button type="button" onMouseEnter={() => setHighlighted(state.id)} onFocus={() => setHighlighted(state.id)} className="cc-focus-ring flex min-h-8 w-full items-center justify-between gap-3 rounded-cc-sm px-2 text-left text-[12px] text-cc-secondary transition-[background-color] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-softer"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: state.color }} />{state.label}</span><span className="font-bold text-cc-text tabular-nums">{counts[state.id]}</span></button></li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
