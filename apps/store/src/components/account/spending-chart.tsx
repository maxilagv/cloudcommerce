"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useMyOrders } from "@/hooks/use-my-orders";
import { mapOrderStatus, type StoreOrderSummary } from "@/lib/api/orders";
import type { SpendingPoint } from "@/lib/account-types";
import { formatPrice } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const PERIODS = ["3M", "6M", "12M"] as const;
type Period = (typeof PERIODS)[number];
const MONTHS_BY_PERIOD: Record<Period, number> = { "3M": 3, "6M": 6, "12M": 12 };
const W = 600;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 32, left: 8 };

function buildSpendingSeries(orders: StoreOrderSummary[], months: number): SpendingPoint[] {
  const now = new Date();
  const buckets: { key: string; month: string; amount: number }[] = [];
  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const shortMonth = date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
    buckets.push({ key, month: shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1), amount: 0 });
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const order of orders) {
    if (mapOrderStatus(order.status) === "cancelled") continue;
    const date = new Date(order.createdAt);
    const bucket = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.amount += Math.round(order.total.amountMinor / 100);
  }
  return buckets.map(({ month, amount }) => ({ month, amount }));
}

function buildPath(points: SpendingPoint[]) {
  const max = Math.max(...points.map((point) => point.amount), 1);
  const xs = points.map((_, index) => PAD.left + (index / Math.max(points.length - 1, 1)) * (W - PAD.left - PAD.right));
  const ys = points.map((point) => PAD.top + (1 - point.amount / max) * (H - PAD.top - PAD.bottom));
  const linePath = xs.map((x, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[index].toFixed(1)}`).join(" ");
  const areaPath = [
    `M ${xs[0].toFixed(1)} ${(H - PAD.bottom).toFixed(1)}`,
    ...xs.map((x, index) => `L ${x.toFixed(1)} ${ys[index].toFixed(1)}`),
    `L ${xs[xs.length - 1].toFixed(1)} ${(H - PAD.bottom).toFixed(1)}`,
    "Z",
  ].join(" ");
  return { linePath, areaPath, xs, ys, max };
}

export function SpendingChart() {
  const { orders, loading } = useMyOrders();
  const [period, setPeriod] = useState<Period>("6M");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: SpendingPoint } | null>(null);
  const hasDrawn = useRef(false);
  const points = useMemo(() => buildSpendingSeries(orders, MONTHS_BY_PERIOD[period]), [orders, period]);
  const { linePath, areaPath, xs, ys, max } = buildPath(points);
  const total = points.reduce((sum, point) => sum + point.amount, 0);
  const initialDraw = !hasDrawn.current;
  hasDrawn.current = true;

  return (
    <section className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm" aria-labelledby="spending-title">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p id="spending-title" className="text-[12px] font-medium text-cc-muted">Total gastado</p>
          {loading ? <Skeleton variant="text" className="mt-1 h-7 w-32" /> : <p className="text-[22px] font-black leading-tight tracking-tight text-cc-text tabular-nums">{formatPrice(total)}</p>}
        </div>
        <div className="relative flex items-center gap-1 rounded-full bg-cc-page p-0.5" aria-label="Período del gráfico">
          {PERIODS.map((item) => {
            const selected = period === item;
            return (
              <button key={item} type="button" onClick={() => { setPeriod(item); setTooltip(null); }} className={`cc-focus-ring relative min-h-8 rounded-full px-3 text-[12px] font-semibold ${selected ? "text-cc-shell" : "text-cc-muted hover:text-cc-text"}`} aria-pressed={selected}>
                {selected && <motion.span layoutId="spending-period" transition={{ type: "spring", stiffness: 400, damping: 30 }} className="absolute inset-0 rounded-full bg-cc-primary" />}
                <span className="relative">{item}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <Skeleton variant="chart" className="h-[180px] w-full" />
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[180px] w-full" onMouseLeave={() => setTooltip(null)} role="img" aria-label="Evolución de compras por mes">
            <defs>
              <linearGradient id="spending-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--cc-primary)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--cc-primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {Array.from({ length: 4 }, (_, index) => {
              const y = PAD.top + (index / 3) * (H - PAD.top - PAD.bottom);
              const value = max * (1 - index / 3);
              return (
                <g key={index}>
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--cc-border-default)" strokeWidth="1" />
                  {index > 0 && <text x={PAD.left} y={y - 4} fontSize="10" fill="var(--cc-text-faint)">{value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(1)}M` : `$${(value / 1_000).toFixed(0)}K`}</text>}
                </g>
              );
            })}
            <motion.g key={period} initial={initialDraw ? { opacity: 0 } : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: initialDraw ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}>
              <motion.path d={areaPath} fill="url(#spending-gradient)" initial={initialDraw ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: initialDraw ? 0.8 : 0, ease: [0.22, 1, 0.36, 1] }} />
              <motion.path d={linePath} fill="none" stroke="var(--cc-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={initialDraw ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: initialDraw ? 0.8 : 0.15, ease: [0.22, 1, 0.36, 1] }} />
            </motion.g>
            {xs.map((x, index) => {
              const active = tooltip?.point === points[index];
              return (
                <g key={points[index].month}>
                  {active && <motion.circle cx={x} cy={ys[index]} r="7" fill="none" stroke="var(--cc-primary)" strokeOpacity="0.25" initial={{ opacity: 0, transform: "scale(0.9)" }} animate={{ opacity: [0.7, 0, 0.7], transform: ["scale(1)", "scale(1.3)", "scale(1)"] }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />}
                  <circle cx={x} cy={ys[index]} r="5" fill="var(--cc-shell)" stroke="var(--cc-primary)" strokeWidth="2" className="cursor-pointer" onMouseEnter={() => setTooltip({ x, y: ys[index], point: points[index] })} />
                  <text x={x} y={H - 4} fontSize="10" fill="var(--cc-text-faint)" textAnchor="middle">{points[index].month}</text>
                </g>
              );
            })}
          </svg>
          {tooltip && (
            <motion.div initial={{ opacity: 0, transform: "scale(0.95)" }} animate={{ opacity: 1, transform: "scale(1)" }} transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }} className="pointer-events-none absolute z-10 -mt-2 -translate-x-1/2 -translate-y-full rounded-cc-sm bg-cc-text px-2.5 py-1.5 text-[12px] font-semibold text-cc-shell shadow-cc-md" style={{ left: `${(tooltip.x / W) * 100}%`, top: `${(tooltip.y / H) * 100}%`, transformOrigin: `${tooltip.x}px ${tooltip.y}px` }}>
              {tooltip.point.month}: {formatPrice(tooltip.point.amount)}
            </motion.div>
          )}
        </div>
      )}
    </section>
  );
}
