import { Skeleton } from "@/components/ui/skeleton";

/** Product detail skeleton: same 45/35/20 desktop split as ProductDetail. */
export default function ProductDetailLoading() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6">
      <Skeleton className="h-4 w-64" />

      <div
        className="mt-5 hidden lg:grid lg:items-start lg:gap-8"
        style={{ gridTemplateColumns: "45% 35% 20%" }}
      >
        <Skeleton variant="image" className="aspect-square w-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-[70%]" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton variant="card" className="h-[320px] w-full" />
      </div>

      <div className="mt-5 flex flex-col gap-6 lg:hidden">
        <Skeleton variant="image" className="aspect-square w-full" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton variant="card" className="h-[280px] w-full" />
      </div>

      <div className="mt-10 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    </main>
  );
}
