"use client";

import type { RecentActivityResponse } from "@cloudcommerce/types";
import { StatusBadge } from "@cloudcommerce/ui";
import { formatDate, formatMinor } from "@/lib/format";

export function RecentActivity({ data }: { data: RecentActivityResponse }) {
  const empty = data.orders.length === 0 && data.customers.length === 0;
  if (empty) {
    return <div className="admin-empty" style={{ padding: "24px 0" }}>Sin actividad reciente</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div>
        <div className="admin-activity__h">Últimos pedidos</div>
        {data.orders.length === 0 ? (
          <div className="admin-cell-sub">Sin pedidos</div>
        ) : (
          data.orders.slice(0, 5).map((o) => (
            <div key={o.orderId} className="admin-activity__row">
              <div style={{ minWidth: 0 }}>
                <div className="admin-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {o.orderNumber}
                </div>
                <div className="admin-cell-sub">
                  {o.customerLabel} · {formatDate(o.createdAt)}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span className="admin-mono" style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {formatMinor(o.total.amountMinor)}
                </span>
                <StatusBadge status={o.status} />
              </div>
            </div>
          ))
        )}
      </div>
      <div>
        <div className="admin-activity__h">Nuevos clientes</div>
        {data.customers.length === 0 ? (
          <div className="admin-cell-sub">Sin clientes nuevos</div>
        ) : (
          data.customers.slice(0, 5).map((c) => (
            <div key={c.customerId} className="admin-activity__row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 560 }}>{c.displayName}</div>
                <div className="admin-cell-sub">{formatDate(c.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
