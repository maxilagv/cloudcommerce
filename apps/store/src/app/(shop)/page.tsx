import type { Metadata } from "next";
import { BrandStrip } from "@/components/home/brand-strip";
import { CategoryShowcase } from "@/components/home/category-showcase";
import { CuratedCollections } from "@/components/home/curated-collections";
import { FeaturedProducts } from "@/components/home/featured-products";
import { HomeBenefitsStrip } from "@/components/home/home-benefits-strip";
import { HomeHero } from "@/components/home/home-hero";
import { HomeTrustRow } from "@/components/home/home-trust-row";
import { PromoGrid } from "@/components/home/promo-grid";
import { JsonLd } from "@/components/seo/JsonLd";
import { getStoreCategories, getStoreProducts, mediaUrl } from "@/lib/api/catalog";
import {
  buildHeroShowcase,
  buildHomeBrands,
  buildHomeCategories,
  buildHomeCollections,
  buildHomeFeaturedProducts,
  buildHomePromos,
} from "@/lib/home-data";
import { buildHomeMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export const metadata: Metadata = buildHomeMetadata();

// Every section is derived from the live catalog.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    getStoreProducts({ limit: 24 }),
    getStoreCategories(),
  ]);

  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <div className="px-3 py-4 sm:px-5 lg:py-6">
        <div className="mx-auto max-w-[1448px] rounded-[28px] border border-cc-border bg-white p-3 shadow-cc-md sm:p-4 lg:p-6">
          <HomeHero showcase={buildHeroShowcase(products)} />
          <HomeBenefitsStrip />
          <CategoryShowcase categories={buildHomeCategories(categories, mediaUrl)} />
          <BrandStrip brands={buildHomeBrands(products)} />
          <PromoGrid promos={buildHomePromos(products)} />
          <FeaturedProducts products={buildHomeFeaturedProducts(products)} />
          <CuratedCollections collections={buildHomeCollections(categories, mediaUrl)} />
          <HomeTrustRow />
        </div>
      </div>
    </>
  );
}
