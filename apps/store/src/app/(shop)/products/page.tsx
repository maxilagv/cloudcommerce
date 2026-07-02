import type { Metadata } from "next";
import { CatalogLayout } from "@/components/product/catalog-layout";
import { buildCatalogMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildCatalogMetadata();

export default function ProductsPage() {
  return <CatalogLayout />;
}
