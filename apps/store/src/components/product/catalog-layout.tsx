import { FilterSidebar } from "./filters";
import { CatalogContent } from "./catalog-content";

/** Two-column catalog layout: 240px sidebar + content (collapses below lg). */
export function CatalogLayout() {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6">
      <FilterSidebar />
      <CatalogContent />
    </div>
  );
}
