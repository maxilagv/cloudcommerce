import { RouteProgressBar } from "@/components/ui/route-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Only the <main> content area — AccountSidebar renders in account/layout.tsx
 * outside this Suspense boundary, so it stays static while this loads.
 */
export default function OrdersLoading() {
  return (
    <div>
      <RouteProgressBar />
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="card" className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
