"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useCountUp } from "./use-count-up";

export interface KpiCardProps {
  label: string;
  /** Raw numeric value to count up to. */
  value: number;
  /** Formats the animated value for display (e.g. formatARS or plain integer). */
  format: (n: number) => string;
  icon: LucideIcon;
  delta?: { pct: number; positive: boolean; label?: string };
  index?: number;
}

export function KpiCard({ label, value, format, icon: Icon, delta, index = 0 }: KpiCardProps) {
  const animated = useCountUp(value);

  return (
    <div className="admin-kpi" style={{ animation: `admin-fade-up .4s var(--admin-ease-out) ${index * 0.06}s both` }}>
      <div className="admin-kpi__h">
        <span className="admin-kpi__lbl">{label}</span>
        <span className="admin-kpi__ic">
          <Icon size={17} />
        </span>
      </div>
      <div className="admin-kpi__num tabular-nums">{format(animated)}</div>
      {delta && (
        <div className={`admin-kpi__dl admin-kpi__dl--${delta.positive ? "up" : "down"}`}>
          {delta.positive ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
          {Math.abs(delta.pct).toFixed(1)}%
          <span className="m">{delta.label ?? "vs. anterior"}</span>
        </div>
      )}
    </div>
  );
}
