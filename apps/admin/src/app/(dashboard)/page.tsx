"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BadgeDollarSign,
  Boxes,
  ClipboardList,
  Package,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@cloudcommerce/ui";
import type { DashboardRange, Kpi, Money } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatARS, formatMinor } from "@/lib/format";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingList } from "@/components/dashboard/ranking-list";
import { LowStockPanel } from "@/components/dashboard/low-stock-panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { StatusDonut } from "@/components/charts/status-donut";

const RANGES: DashboardRange[] = ["7d", "30d", "12m"];
const RANGE_LABEL: Record<DashboardRange, string> = { "7d": "7d", "30d": "30d", "12m": "12m" };

type SeriesMetric = "revenue" | "orders";

interface KpiEntry {
  label: string;
  value: number;
  format: (n: number) => string;
  icon: LucideIcon;
  delta?: { pct: number; positive: boolean };
}

function moneyKpi(kpi: Kpi<Money> | undefined, icon: LucideIcon): KpiEntry | null {
  if (!kpi) return null;
  return {
    label: kpi.label,
    value: kpi.value.amountMinor / 100,
    format: formatARS,
    icon,
    ...(kpi.delta ? { delta: { pct: kpi.delta.pct, positive: kpi.delta.positive } } : {}),
  };
}

function countKpi(kpi: Kpi<number> | undefined, icon: LucideIcon): KpiEntry | null {
  if (!kpi) return null;
  return {
    label: kpi.label,
    value: kpi.value,
    format: (n) => Math.round(n).toLocaleString("es-AR"),
    icon,
    ...(kpi.delta ? { delta: { pct: kpi.delta.pct, positive: kpi.delta.positive } } : {}),
  };
}

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [metric, setMetric] = useState<SeriesMetric>("revenue");

  const me = useQuery({ queryKey: ["identity", "me"], queryFn: () => trpc.identity.me.query(), retry: false });
  const overview = useQuery({
    queryKey: ["dashboard", "overview", range],
    queryFn: () => trpc.dashboard.getOverview.query({ range }),
  });
  const series = useQuery({
    queryKey: ["dashboard", "series", range, metric],
    queryFn: () => trpc.dashboard.getSalesTimeSeries.query({ range, metric }),
    retry: false,
  });
  const category = useQuery({
    queryKey: ["dashboard", "category", range],
    queryFn: () => trpc.dashboard.getSalesByCategory.query({ range, metric: "revenue", limit: 8 }),
    retry: false,
  });
  const topProducts = useQuery({
    queryKey: ["dashboard", "topProducts", range],
    queryFn: () => trpc.dashboard.getTopProducts.query({ range, metric: "revenue", limit: 5 }),
    retry: false,
  });
  const topCustomers = useQuery({
    queryKey: ["dashboard", "topCustomers", range],
    queryFn: () => trpc.dashboard.getTopCustomers.query({ range, limit: 5 }),
    retry: false,
  });
  const lowStock = useQuery({
    queryKey: ["dashboard", "lowStock"],
    queryFn: () => trpc.dashboard.getLowStockAlerts.query({ limit: 8, threshold: "reorder_point" }),
    retry: false,
  });
  const recent = useQuery({
    queryKey: ["dashboard", "recent"],
    queryFn: () => trpc.dashboard.getRecentActivity.query({ limit: 10 }),
  });

  const firstName = me.data?.profile.fullName.split(" ")[0] ?? "";

  const kpis: KpiEntry[] = overview.data
    ? [
        moneyKpi(overview.data.kpis.sales, TrendingUp),
        moneyKpi(overview.data.kpis.margin, BadgeDollarSign),
        countKpi(overview.data.kpis.orders, ClipboardList),
        countKpi(overview.data.kpis.newCustomers, Users),
        countKpi(overview.data.kpis.publishedProducts, Package),
        countKpi(overview.data.kpis.lowStockCount, Boxes),
      ].filter((k): k is KpiEntry => k !== null)
    : [];

  const seriesFormat = metric === "revenue" ? formatMinor : (n: number) => Math.round(n).toLocaleString("es-AR");

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Hola{firstName ? `, ${firstName}` : ""} 👋</h1>
          <div className="admin-ph__sub">El pulso de tu tienda · últimos {RANGE_LABEL[range]}</div>
        </div>
        <div className="admin-ph__actions">
          <div className="admin-segs">
            {RANGES.map((r) => (
              <button key={r} data-on={r === range || undefined} onClick={() => setRange(r)}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="admin-grid admin-grid--kpi">
        {overview.isLoading
          ? [0, 1, 2, 3].map((i) => (
              <div className="admin-kpi" key={i}>
                <Skeleton height={12} width="55%" />
                <div style={{ marginTop: 14 }}>
                  <Skeleton height={24} width="65%" />
                </div>
              </div>
            ))
          : kpis.slice(0, 4).map((k, i) => (
              <KpiCard key={k.label} label={k.label} value={k.value} format={k.format} icon={k.icon} delta={k.delta} index={i} />
            ))}
      </div>

      {/* serie temporal + donut de estados */}
      <div className="admin-grid admin-grid--2" style={{ marginTop: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Ventas — serie temporal</h3>
            <div className="admin-segs">
              <button data-on={metric === "revenue" || undefined} onClick={() => setMetric("revenue")}>
                Ingresos
              </button>
              <button data-on={metric === "orders" || undefined} onClick={() => setMetric("orders")}>
                Pedidos
              </button>
            </div>
          </div>
          {series.isLoading ? (
            <Skeleton height={200} radius={12} />
          ) : series.isError || !series.data ? (
            <div className="admin-empty" style={{ padding: "40px 0" }}>No disponible para tu rol</div>
          ) : (
            <RevenueAreaChart points={series.data.points} format={seriesFormat} />
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Pedidos por estado</h3>
          </div>
          {overview.isLoading ? (
            <Skeleton height={130} radius={12} />
          ) : (
            <StatusDonut data={overview.data?.ordersByStatus ?? []} />
          )}
        </div>
      </div>

      {/* categoría + top productos */}
      <div className="admin-grid admin-grid--12" style={{ marginTop: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Ventas por categoría</h3>
          </div>
          {category.isLoading ? (
            <Skeleton height={160} radius={12} />
          ) : category.isError || !category.data ? (
            <div className="admin-empty" style={{ padding: "30px 0" }}>No disponible para tu rol</div>
          ) : (
            <CategoryBarChart slices={category.data.slices} format={formatMinor} />
          )}
        </div>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Top productos</h3>
          </div>
          {topProducts.isLoading ? (
            <Skeleton height={160} radius={12} />
          ) : topProducts.isError || !topProducts.data ? (
            <div className="admin-empty" style={{ padding: "30px 0" }}>No disponible</div>
          ) : (
            <RankingList
              showThumb
              items={topProducts.data.items.map((p) => ({
                id: p.productId,
                label: p.title,
                value: p.revenue.amountMinor,
                valueLabel: formatMinor(p.revenue.amountMinor),
              }))}
            />
          )}
        </div>
      </div>

      {/* stock bajo + top clientes */}
      <div className="admin-grid admin-grid--12" style={{ marginTop: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Stock bajo</h3>
          </div>
          {lowStock.isLoading ? (
            <Skeleton height={140} radius={12} />
          ) : lowStock.isError || !lowStock.data ? (
            <div className="admin-empty" style={{ padding: "30px 0" }}>No disponible para tu rol</div>
          ) : (
            <LowStockPanel items={lowStock.data.items} />
          )}
        </div>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Top clientes</h3>
          </div>
          {topCustomers.isLoading ? (
            <Skeleton height={140} radius={12} />
          ) : topCustomers.isError || !topCustomers.data ? (
            <div className="admin-empty" style={{ padding: "30px 0" }}>No disponible para tu rol</div>
          ) : (
            <RankingList
              items={topCustomers.data.items.map((c) => ({
                id: c.customerId,
                label: c.displayName,
                sublabel: `${c.ordersCount} pedidos`,
                value: c.totalSpent.amountMinor,
                valueLabel: formatMinor(c.totalSpent.amountMinor),
              }))}
            />
          )}
        </div>
      </div>

      {/* actividad reciente */}
      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel__h">
          <h3>Actividad reciente</h3>
        </div>
        {recent.isLoading ? (
          <Skeleton height={120} radius={12} />
        ) : recent.data ? (
          <RecentActivity data={recent.data} />
        ) : (
          <div className="admin-empty" style={{ padding: "24px 0" }}>Sin actividad</div>
        )}
      </div>
    </div>
  );
}
