import { Skeleton } from "@/components/ui/skeleton";

/** Catalog skeleton: sidebar + hero banner + toolbar + product grid, same widths as CatalogLayout. */
export default function ProductsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6">
      <aside className="hidden w-[240px] shrink-0 lg:block">
        <div className="space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[80%]" />
              <Skeleton className="h-4 w-[60%]" />
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <Skeleton variant="card" className="h-[160px] w-full" />

        <div className="mt-6 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-40 rounded-cc-sm" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} variant="card" className="h-[420px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
