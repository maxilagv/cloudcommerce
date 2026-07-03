"use client";

import { Package } from "lucide-react";

export interface RankingItem {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  valueLabel: string;
}

export function RankingList({ items, showThumb = false }: { items: RankingItem[]; showThumb?: boolean }) {
  if (items.length === 0) {
    return <div className="admin-empty" style={{ padding: "24px 0" }}>Sin datos en el período</div>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id} className="admin-rank-row">
          <span className="admin-rank-row__n">{i + 1}</span>
          {showThumb && (
            <span className="admin-rank-row__thumb">
              <Package size={16} />
            </span>
          )}
          <div className="admin-rank-row__info">
            <div className="admin-rank-row__nm">{item.label}</div>
            <div className="admin-rank-row__bar">
              <span style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
          <span className="admin-rank-row__amt tabular-nums">{item.valueLabel}</span>
        </div>
      ))}
    </div>
  );
}
