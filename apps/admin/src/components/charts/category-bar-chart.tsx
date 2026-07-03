"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategorySlice } from "@cloudcommerce/types";
import { ChartTooltip } from "./chart-kit";

export interface CategoryBarChartProps {
  slices: CategorySlice[];
  format: (n: number) => string;
}

/** Horizontal ranking — reads faster than a pie for "which categories move the needle". */
export function CategoryBarChart({ slices, format }: CategoryBarChartProps) {
  if (slices.length === 0) {
    return <div className="admin-empty" style={{ padding: "30px 0" }}>Sin ventas en el período</div>;
  }
  const height = Math.max(140, slices.length * 34);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={slices} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 6 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "var(--admin-text-secondary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip cursor={{ fill: "var(--admin-bg-hover)" }} content={<ChartTooltip formatter={format} />} />
        <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 5, 5, 0]} barSize={16} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}
