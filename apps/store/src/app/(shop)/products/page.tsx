import type { Metadata } from "next";
import { CatalogLayout } from "@/components/product/catalog-layout";
import { CatalogSync } from "@/components/product/catalog-sync";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  findCategoryBySlug,
  getStoreCategories,
  getStoreProducts,
} from "@/lib/api/catalog";
import type { CatalogQuery, SortKey } from "@/lib/catalog-filter";
import type { CategoryLink } from "@/lib/catalog-types";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/seo/jsonld";
import { buildCatalogMetadata } from "@/lib/seo/metadata";
import { BASE_URL } from "@/lib/seo/site";

// The catalog reflects live stock/prices, so render per-request.
export const dynamic = "force-dynamic";

type CatalogSearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  deals?: string;
  sort?: string;
};

type Props = { searchParams: Promise<CatalogSearchParams> };

const SORT_KEYS = ["relevance", "price-asc", "price-desc", "newest"] as const;

function parseSort(value: string | undefined): SortKey {
  return (SORT_KEYS as readonly string[]).includes(value ?? "")
    ? (value as SortKey)
    : "relevance";
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const category = findCategoryBySlug(await getStoreCategories(), sp.category);
  return buildCatalogMetadata({
    category: category
      ? {
          name: category.name,
          slug: category.slug,
          seoTitle: category.seoTitle,
          seoDescription: category.seoDescription,
        }
      : undefined,
    brand: sp.brand,
    deals: sp.deals === "1",
    query: sp.q?.trim() || undefined,
  });
}

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const categories = await getStoreCategories();
  const activeCategory = findCategoryBySlug(categories, sp.category);

  // Category + free text narrow server-side; brand/price/deals refine client-side.
  const products = await getStoreProducts({
    categoryId: activeCategory?.id,
    query: sp.q?.trim() || undefined,
    limit: 48,
  });

  const categoryLinks: CategoryLink[] = categories
    .filter((c) => c.isActive)
    .map((c) => ({ label: c.name, slug: c.slug }));

  const initial: Partial<CatalogQuery> = {
    brands: sp.brand ? [sp.brand] : [],
    availability: sp.deals === "1" ? ["deals"] : [],
    sort: parseSort(sp.sort),
  };

  const listUrl = activeCategory
    ? `${BASE_URL}/products?category=${encodeURIComponent(activeCategory.slug)}`
    : `${BASE_URL}/products`;

  const breadcrumb = [
    { label: "Inicio", href: "/" },
    { label: "Catálogo", href: "/products" },
    ...(activeCategory ? [{ label: activeCategory.name }] : []),
  ];

  return (
    <>
      <JsonLd
        data={buildItemListJsonLd(products, listUrl, activeCategory?.name ?? "Catálogo")}
      />
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumb)} />
      <CatalogSync initial={initial} resetKey={JSON.stringify(sp)} />
      <CatalogLayout
        products={products}
        categories={categoryLinks}
        activeCategory={
          activeCategory
            ? { label: activeCategory.name, slug: activeCategory.slug }
            : undefined
        }
      />
    </>
  );
}
