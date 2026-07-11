import { RouteProgressBar } from "@/components/ui/route-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";

/** Cart page skeleton: items list + sticky summary, same 2-column split as CartPage. */
export default function CartLoading() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <RouteProgressBar />
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4 rounded-cc-lg border border-cc-border bg-white p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-cc-border-subtle pb-4 last:border-0">
              <Skeleton variant="image" className="h-20 w-20 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[70%]" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))}
        </div>

        <div className="h-fit space-y-3 rounded-cc-lg border border-cc-border bg-white p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="mt-3 h-12 w-full rounded-[11px]" />
        </div>
      </div>
    </div>
  );
}
