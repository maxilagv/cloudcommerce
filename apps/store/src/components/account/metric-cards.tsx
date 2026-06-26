import { ShoppingBag, Tag, Package, Star } from "lucide-react";
import { mockMetrics } from "@/lib/mock-account";

const icons = {
  "shopping-bag": ShoppingBag,
  tag: Tag,
  package: Package,
  star: Star,
} as const;

export function MetricCards() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {mockMetrics.map((m) => {
        const Icon = icons[m.icon as keyof typeof icons];
        return (
          <div
            key={m.label}
            className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 hover:shadow-cc-md hover:-translate-y-px transition-all duration-[220ms] ease-cc-out"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-medium text-cc-muted leading-snug">
                {m.label}
              </p>
              <span className="h-7 w-7 rounded-cc-sm bg-cc-primary-soft flex items-center justify-center shrink-0">
                <Icon className="h-3.5 w-3.5 text-cc-primary" strokeWidth={1.8} />
              </span>
            </div>
            <p className="text-[22px] font-black text-cc-text leading-tight mt-2 tracking-tight">
              {m.value}
            </p>
            <span
              className={[
                "inline-block mt-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                m.positive
                  ? "bg-cc-success-soft text-cc-success"
                  : "bg-cc-danger-soft text-cc-danger",
              ].join(" ")}
            >
              {m.variation}
            </span>
          </div>
        );
      })}
    </div>
  );
}
