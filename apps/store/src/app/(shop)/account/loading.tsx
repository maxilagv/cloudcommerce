import { Skeleton } from "@/components/ui/skeleton";

/**
 * Only the <main> content area — AccountSidebar renders in account/layout.tsx
 * outside this Suspense boundary, so it stays static while this loads.
 * The real dashboard content (metric cards, charts) gets its own richer
 * loading treatment from Bloque 2 — this is just the route-level shell.
 */
export default function AccountLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton variant="chart" className="h-64 w-full" />
        <Skeleton variant="chart" className="h-64 w-full" />
      </div>
    </div>
  );
}
