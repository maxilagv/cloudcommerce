import { RouteProgressBar } from "@/components/ui/route-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";

/** Home skeleton: mirrors the rounded shell + hero + strip + grid of the real page. */
export default function HomeLoading() {
  return (
    <div className="px-3 py-4 sm:px-5 lg:py-6">
      <RouteProgressBar />
      <div className="mx-auto max-w-[1448px] rounded-[28px] border border-cc-border bg-white p-3 shadow-cc-md sm:p-4 lg:p-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-[30px] border border-cc-border px-5 py-8 sm:px-8 lg:px-16 lg:py-12">
          <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="max-w-[560px] space-y-4">
              <Skeleton className="h-7 w-40 rounded-full" />
              <Skeleton className="h-12 w-full max-w-[480px]" />
              <Skeleton className="h-12 w-[70%]" />
              <Skeleton className="h-4 w-full max-w-[480px]" />
              <Skeleton className="h-4 w-[60%]" />
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-12 w-40 rounded-full" />
                <Skeleton className="h-12 w-40 rounded-full" />
              </div>
            </div>
            <Skeleton variant="image" className="h-[280px] w-full rounded-[24px] lg:h-[360px]" />
          </div>
        </div>

        {/* Benefits strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-cc-lg" />
          ))}
        </div>

        {/* Category showcase */}
        <div className="mt-8 flex gap-3 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-28 w-28 shrink-0" />
          ))}
        </div>

        {/* Featured products grid */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-[420px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
