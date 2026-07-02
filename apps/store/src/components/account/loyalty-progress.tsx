import { Check, ArrowRight } from "lucide-react";
import { mockLoyalty } from "@/lib/mock-account";

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function LoyaltyProgress() {
  const { tier, points, nextTier, nextTierPoints, progressPct, benefits } =
    mockLoyalty;
  const dashOffset = CIRCUMFERENCE * (1 - progressPct / 100);

  return (
    <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-5 flex flex-col gap-4">
      <h2 className="text-[15px] font-bold text-cc-text">Tu progreso</h2>

      {/* Ring */}
      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
          <svg width="128" height="128" viewBox="0 0 128 128">
            {/* Track */}
            <circle
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              stroke="#EEF2F7"
              strokeWidth="10"
            />
            {/* Progress */}
            <circle
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              stroke="#0B6BFF"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 64 64)"
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[18px] font-black text-cc-text leading-tight">
              {(points / 1000).toFixed(1)}K
            </span>
            <span className="text-[10px] text-cc-muted font-medium">puntos</span>
          </div>
        </div>

        <div className="flex-1">
          <p className="text-[13px] font-semibold text-cc-text">{tier}</p>
          <p className="text-[12px] text-cc-muted mt-0.5">
            {(nextTierPoints - points).toLocaleString("es-CO")} pts para{" "}
            <span className="font-semibold text-cc-primary">{nextTier}</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-cc-bg-page overflow-hidden">
            <div
              className="h-full rounded-full bg-cc-primary transition-all duration-[360ms] ease-cc-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[10px] text-cc-faint mt-1">{progressPct}% completado</p>
        </div>
      </div>

      {/* Benefits */}
      <ul className="flex flex-col gap-2">
        {benefits.map((b) => (
          <li key={b.label} className="flex items-center gap-2">
            <span
              className={[
                "h-4 w-4 rounded-full flex items-center justify-center shrink-0",
                b.active ? "bg-cc-success-soft" : "bg-cc-border-subtle",
              ].join(" ")}
            >
              <Check
                className={[
                  "h-2.5 w-2.5",
                  b.active ? "text-cc-success" : "text-cc-faint",
                ].join(" ")}
                strokeWidth={2.5}
              />
            </span>
            <span
              className={[
                "text-[12px]",
                b.active ? "text-cc-secondary" : "text-cc-faint line-through",
              ].join(" ")}
            >
              {b.label}
            </span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="flex items-center justify-center gap-1.5 w-full h-9 rounded-cc-sm border border-cc-primary-border text-[13px] font-semibold text-cc-primary bg-cc-primary-soft hover:bg-cc-primary hover:text-white transition-colors duration-[140ms] ease-cc-out cc-focus-ring"
      >
        Conocer todos los beneficios
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
