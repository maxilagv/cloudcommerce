import type { CategoryLink, ProductCardData } from "@/lib/catalog-types";
import { FilterSidebar } from "./filters";
import { CatalogContent } from "./catalog-content";

/** Two-column catalog layout: 240px sidebar + content (collapses below lg). */
export function CatalogLayout({
  products,
  categories,
  activeCategory,
}: {
  products: ProductCardData[];
  categories: CategoryLink[];
  activeCategory?: CategoryLink;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6">
      <FilterSidebar
        products={products}
        categories={categories}
        activeCategory={activeCategory}
      />
      <CatalogContent
        products={products}
        categories={categories}
        activeCategory={activeCategory}
      />
    </div>
  );
}
