import { RouteProgressBar } from "@/components/ui/route-progress-bar";
import { Skeleton } from "@/components/ui/skeleton";

/** Checkout skeleton: step indicator + form area, matches CheckoutPage's single-column flow. */
export default function CheckoutLoading() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <RouteProgressBar />
      <div className="flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            {i < 3 && <Skeleton className="h-0.5 flex-1" />}
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4 rounded-cc-lg border border-cc-border bg-white p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <Skeleton className="mt-4 h-12 w-full rounded-[11px]" />
      </div>
    </div>
  );
}
