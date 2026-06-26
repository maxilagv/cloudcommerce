import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/detail";
import { JsonLd } from "@/components/seo/JsonLd";
import { getProductDetail } from "@/lib/mock-product-detail";
import { buildProductMetadata, buildNotFoundMetadata } from "@/lib/seo/metadata";
import { buildProductJsonLd, buildBreadcrumbJsonLd, organizationJsonLd } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductDetail(slug);
  if (!product) return buildNotFoundMetadata();
  return buildProductMetadata(product);
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = getProductDetail(slug);
  if (!product) notFound();
  return (
    <>
      <JsonLd data={buildProductJsonLd(product)} />
      <JsonLd data={buildBreadcrumbJsonLd(product.breadcrumb)} />
      <JsonLd data={organizationJsonLd} />
      <ProductDetail product={product} />
    </>
  );
}
