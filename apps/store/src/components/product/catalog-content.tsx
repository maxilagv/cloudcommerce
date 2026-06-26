import { HeroBanner } from "./hero-banner";
import { CategoryChips } from "./category-chips";
import { CatalogToolbar } from "./catalog-toolbar";
import { CatalogResults } from "./catalog-results";
import { AiRecommendations } from "./ai-recommendations";

/** Right column: hero + chips + toolbar + product grid. */
export function CatalogContent() {
  return (
    <div className="min-w-0 flex-1">
      <HeroBanner />

      <div id="catalogo" className="mt-6 scroll-mt-24">
        <CategoryChips />
      </div>

      <AiRecommendations />

      <div className="mt-4">
        <CatalogToolbar />
      </div>

      <div className="mt-5">
        <CatalogResults />
      </div>
    </div>
  );
}
