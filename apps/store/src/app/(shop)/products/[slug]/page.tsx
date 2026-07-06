import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/detail";
import { JsonLd } from "@/components/seo/JsonLd";
import { getLoyaltyProgram, getProductDetailBySlug } from "@/lib/api/catalog";
import { buildProductMetadata, buildNotFoundMetadata } from "@/lib/seo/metadata";
import { buildProductJsonLd, buildBreadcrumbJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

// Product detail (price/stock) is live data.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);
  if (!product) return buildNotFoundMetadata();
  return buildProductMetadata(product);
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const [product, loyaltyProgram] = await Promise.all([
    getProductDetailBySlug(slug),
    getLoyaltyProgram(),
  ]);
  if (!product) notFound();
  const pointsPer1000 = loyaltyProgram?.isEnabled ? loyaltyProgram.pointsPer1000 : 0;
  return (
    <>
      <JsonLd data={buildProductJsonLd(product)} />
      <JsonLd data={buildBreadcrumbJsonLd(product.breadcrumb)} />
      <JsonLd data={organizationJsonLd} />
      <ProductDetail product={product} pointsPer1000={pointsPer1000} />
    </>
  );
}
