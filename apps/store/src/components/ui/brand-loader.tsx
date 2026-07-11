import { cn } from "@/lib/utils";

/** Cloud mark from app/icon.tsx, traced on load instead of a generic spinner. */
const CLOUD_PATH =
  "M354 322c36 0 66-29 66-65 0-33-25-61-58-65-8-54-55-96-111-96-49 0-91 31-106 75-38 4-67 36-67 74 0 42 34 77 76 77h200z";

interface BrandLoaderProps {
  className?: string;
  label?: string;
}

/** Brand loading state: the cloud mark draws itself in, with a soft shimmer halo. */
export function BrandLoader({ className, label = "Cargando" }: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("grid place-items-center gap-3 py-16", className)}
    >
      <div className="relative grid h-20 w-20 place-items-center">
        <div className="cc-skeleton absolute inset-0 rounded-full opacity-60" />
        <svg width="56" height="56" viewBox="0 0 512 512" fill="none" className="relative">
          <path
            d={CLOUD_PATH}
            stroke="var(--cc-primary)"
            strokeWidth="30"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="cc-brand-loader-path"
          />
        </svg>
      </div>
      <span className="sr-only">{label}…</span>
    </div>
  );
}
