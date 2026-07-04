"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { StatusBadge } from "@cloudcommerce/ui";
import { STATUS_COLOR } from "./chart-kit";

export interface StatusDonutDatum {
  status: string;
  count: number;
}

export function StatusDonut({ data }: { data: StatusDonutDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const nonEmpty = data.filter((d) => d.count > 0);

  if (total === 0) {
    return <div className="admin-empty" style={{ padding: "30px 0" }}>Sin pedidos en el período</div>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: 130, height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={nonEmpty}
              dataKey="count"
              nameKey="status"
              innerRadius={44}
              outerRadius={62}
              paddingAngle={2}
              stroke="none"
              animationDuration={800}
            >
              {nonEmpty.map((d) => (
                <Cell key={d.status} fill={STATUS_COLOR[d.status] ?? "var(--chart-4)"} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 20, fontWeight: 750 }} className="tabular-nums">
            {total}
          </span>
          <span style={{ fontSize: 10.5, color: "var(--admin-text-muted)" }}>pedidos</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1, minWidth: 150 }}>
        {nonEmpty.map((d) => (
          <div key={d.status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <StatusBadge status={d.status} />
            <span style={{ marginLeft: "auto", fontWeight: 650 }} className="tabular-nums">
              {Math.round((d.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
