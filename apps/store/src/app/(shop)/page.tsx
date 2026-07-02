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
import { buildHomeMetadata } from "@/lib/seo/metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export const metadata: Metadata = buildHomeMetadata();

export default function HomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <div className="px-3 py-4 sm:px-5 lg:py-6">
        <div className="mx-auto max-w-[1448px] rounded-[28px] border border-cc-border bg-white p-3 shadow-cc-md sm:p-4 lg:p-6">
          <HomeHero />
          <HomeBenefitsStrip />
          <CategoryShowcase />
          <BrandStrip />
          <PromoGrid />
          <FeaturedProducts />
          <CuratedCollections />
          <HomeTrustRow />
        </div>
      </div>
    </>
  );
}
