"use client";

import { useState, useRef } from "react";
import { mockSpending, type SpendingPoint } from "@/lib/mock-account";
import { formatCOP } from "@/lib/utils";

const PERIODS = ["3M", "6M", "12M"] as const;
type Period = (typeof PERIODS)[number];

const W = 600;
const H = 180;
const PAD = { top: 16, right: 16, bottom: 32, left: 8 };

function buildPath(points: SpendingPoint[]) {
  const max = Math.max(...points.map((p) => p.amount), 1);
  const xs = points.map((_, i) =>
    PAD.left + (i / (points.length - 1)) * (W - PAD.left - PAD.right)
  );
  const ys = points.map(
    (p) => PAD.top + (1 - p.amount / max) * (H - PAD.top - PAD.bottom)
  );

  const linePath = xs
    .map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`)
    .join(" ");

  const areaPath = [
    `M ${xs[0].toFixed(1)} ${(H - PAD.bottom).toFixed(1)}`,
    ...xs.map((x, i) => `L ${x.toFixed(1)} ${ys[i].toFixed(1)}`),
    `L ${xs[xs.length - 1].toFixed(1)} ${(H - PAD.bottom).toFixed(1)}`,
    "Z",
  ].join(" ");

  return { linePath, areaPath, xs, ys, max };
}

export function SpendingChart() {
  const [period, setPeriod] = useState<Period>("6M");
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    point: SpendingPoint;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const points = mockSpending[period];
  const { linePath, areaPath, xs, ys, max } = buildPath(points);

  const gridLines = 4;
  const total = points.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="text-[12px] font-medium text-cc-muted">Total gastado</p>
          <p className="text-[22px] font-black text-cc-text tracking-tight leading-tight">
            {formatCOP(total)}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-cc-bg-page rounded-full p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPeriod(p); setTooltip(null); }}
              className={[
                "px-3 py-1 rounded-full text-[12px] font-semibold transition-all duration-[140ms] ease-cc-out",
                period === p
                  ? "bg-cc-primary text-white shadow-sm"
                  : "text-cc-muted hover:text-cc-text",
              ].join(" ")}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 180 }}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="spending-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0B6BFF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0B6BFF" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {Array.from({ length: gridLines }).map((_, i) => {
            const y = PAD.top + (i / (gridLines - 1)) * (H - PAD.top - PAD.bottom);
            const val = max * (1 - i / (gridLines - 1));
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={W - PAD.right}
                  y2={y}
                  stroke="#E5EAF2"
                  strokeWidth="1"
                />
                {i > 0 && (
                  <text
                    x={PAD.left}
                    y={y - 4}
                    fontSize="10"
                    fill="#98A2B3"
                    textAnchor="start"
                  >
                    {val >= 1_000_000
                      ? `$${(val / 1_000_000).toFixed(1)}M`
                      : `$${(val / 1_000).toFixed(0)}K`}
                  </text>
                )}
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#spending-gradient)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#0B6BFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {xs.map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={ys[i]}
              r="4"
              fill="white"
              stroke="#0B6BFF"
              strokeWidth="2"
              className="cursor-pointer"
              onMouseEnter={() =>
                setTooltip({ x, y: ys[i], point: points[i] })
              }
            />
          ))}

          {/* X-axis labels */}
          {xs.map((x, i) => (
            <text
              key={i}
              x={x}
              y={H - 4}
              fontSize="10"
              fill="#98A2B3"
              textAnchor="middle"
            >
              {points[i].month}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full -mt-2 bg-cc-text text-white text-[12px] font-semibold px-2.5 py-1.5 rounded-cc-sm shadow-cc-md whitespace-nowrap"
            style={{
              left: `${(tooltip.x / W) * 100}%`,
              top: `${(tooltip.y / H) * 100}%`,
            }}
          >
            {tooltip.point.month}: {formatCOP(tooltip.point.amount)}
          </div>
        )}
      </div>
    </div>
  );
}
