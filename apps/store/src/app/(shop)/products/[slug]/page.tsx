import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/detail";
import { getProductBySlug } from "@/lib/mock-product-detail";

export default function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = getProductBySlug(params.slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
