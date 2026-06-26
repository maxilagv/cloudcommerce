import { Suspense } from "react";
import { SearchResults } from "@/components/product/search-results";

export const metadata = {
  title: "Buscar productos · CloudCommerce",
  robots: { index: false },
};

// useSearchParams() requires a Suspense boundary in Next 15.
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6">
          <div className="h-6 w-48 animate-pulse rounded bg-cc-soft" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
