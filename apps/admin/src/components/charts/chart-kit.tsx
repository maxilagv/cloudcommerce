"use client";

import type { ReactNode } from "react";

/** Categorical data palette (tokens redefine these per theme in globals.css). */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

/** OrderStatus -> semantic color, so charts and StatusBadge speak the same visual language. */
export const STATUS_COLOR: Record<string, string> = {
  DELIVERED: "var(--admin-success)",
  PUBLISHED: "var(--admin-success)",
  CONFIRMED: "var(--admin-accent)",
  PREPARING: "var(--admin-accent)",
  READY_TO_SHIP: "var(--admin-accent)",
  PENDING_CONFIRMATION: "var(--admin-warning)",
  SHIPPED: "var(--admin-warning)",
  CANCELLED: "var(--admin-danger)",
  RETURN_REQUESTED: "var(--admin-danger)",
  RETURNED: "var(--admin-text-faint)",
  DRAFT: "var(--admin-text-faint)",
};

export interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  formatter?: (value: number) => string;
  labelText?: (label: string | number) => string;
}

/** Themed tooltip shared by every chart. */
export function ChartTooltip({ active, label, payload, formatter, labelText }: ChartTooltipProps): ReactNode {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const raw = typeof entry?.value === "number" ? entry.value : Number(entry?.value ?? 0);
  return (
    <div
      style={{
        background: "var(--admin-bg-surface)",
        border: "1px solid var(--admin-border-default)",
        borderRadius: 9,
        padding: "7px 11px",
        boxShadow: "var(--admin-shadow-md)",
        fontSize: 12,
      }}
    >
      {label !== undefined && (
        <div style={{ color: "var(--admin-text-muted)", fontSize: 10.5 }}>
          {labelText ? labelText(label) : label}
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--admin-text-primary)" }}>
        {formatter ? formatter(raw) : raw}
      </div>
    </div>
  );
}
