"use client";

import { Package } from "lucide-react";
import { Badge } from "@cloudcommerce/ui";
import type { LowStockAlertsResponse } from "@cloudcommerce/types";

export function LowStockPanel({ items }: { items: LowStockAlertsResponse["items"] }) {
  if (items.length === 0) {
    return <div className="admin-empty" style={{ padding: "24px 0" }}>Sin alertas de stock 🎉</div>;
  }
  return (
    <table className="ui-table">
      <tbody>
        {items.map((item) => (
          <tr key={item.variantId}>
            <td>
              <div className="admin-mini-prod">
                <span className="admin-mini-prod__mp">
                  <Package size={16} />
                </span>
                <span>
                  <span className="admin-cell-str">{item.productTitle}</span>
                  <span className="admin-cell-sub admin-mono">
                    {item.sku || "sin SKU"} · reorden {item.reorderPoint ?? "—"}
                  </span>
                </span>
              </div>
            </td>
            <td style={{ textAlign: "right" }}>
              <Badge tone={item.severity === "out_of_stock" ? "danger" : "warning"}>
                {item.available} disp.
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
