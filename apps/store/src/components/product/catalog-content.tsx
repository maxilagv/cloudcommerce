import type { CategoryLink, ProductCardData } from "@/lib/catalog-types";
import { HeroBanner } from "./hero-banner";
import { CategoryChips } from "./category-chips";
import { CatalogToolbar } from "./catalog-toolbar";
import { CatalogResults } from "./catalog-results";
import { AiRecommendations } from "./ai-recommendations";

/** Right column: hero + chips + toolbar + product grid. */
export function CatalogContent({
  products,
  categories,
  activeCategory,
}: {
  products: ProductCardData[];
  categories: CategoryLink[];
  activeCategory?: CategoryLink;
}) {
  return (
    <div className="min-w-0 flex-1">
      <HeroBanner products={products} categoryName={activeCategory?.label} />

      <div id="catalogo" className="mt-6 scroll-mt-24">
        <CategoryChips categories={categories} activeCategorySlug={activeCategory?.slug} />
      </div>

      <AiRecommendations products={products} />

      <div className="mt-4">
        <CatalogToolbar
          products={products}
          categories={categories}
          activeCategory={activeCategory}
        />
      </div>

      <div className="mt-5">
        <CatalogResults products={products} />
      </div>
    </div>
  );
}
