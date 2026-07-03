"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeSeriesPoint } from "@cloudcommerce/types";
import { ChartTooltip } from "./chart-kit";

export interface RevenueAreaChartProps {
  points: TimeSeriesPoint[];
  /** Formats Y values and the tooltip (e.g. formatMinor for revenue). */
  format: (n: number) => string;
  height?: number;
}

export function RevenueAreaChart({ points, format, height = 200 }: RevenueAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--chart-axis-text)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: "var(--chart-axis-text)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) => format(v)}
        />
        <Tooltip
          cursor={{ stroke: "var(--admin-accent-border)", strokeWidth: 1 }}
          content={<ChartTooltip formatter={format} labelText={(l) => `Bucket ${l}`} />}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          fill="url(#revGrad)"
          animationDuration={900}
          dot={false}
          activeDot={{ r: 4, fill: "var(--admin-bg-surface)", stroke: "var(--chart-1)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
