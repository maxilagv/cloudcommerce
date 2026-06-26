import { CatalogLayout } from "@/components/product/catalog-layout";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildCatalogMetadata } from "@/lib/seo/metadata";
import { websiteJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";

export const metadata = buildCatalogMetadata();

export default function CatalogHomePage() {
  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={organizationJsonLd} />
      <CatalogLayout />
    </>
  );
}
