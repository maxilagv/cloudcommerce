import Link from "next/link";
import { SearchResults } from "@/components/product/search-results";
import { EmptyState } from "@/components/ui/empty-state";
import { getStoreCategories, getStoreProducts } from "@/lib/api/catalog";
import { categoryHref } from "@/lib/catalog-types";

export const metadata = { title: "Buscar productos · CloudCommerce", robots: { index: false } };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams; const query = (q ?? "").trim(); const products = query ? await getStoreProducts({ query, limit: 48 }) : [];
  if (!query || products.length === 0) { const categories = (await getStoreCategories()).filter((category) => category.isActive).slice(0, 4); return <div className="mx-auto max-w-[880px] px-4 py-24 sm:px-6"><EmptyState title={query ? "No encontramos productos" : "Buscá lo que necesitás"} description={query ? "Probá ajustar la búsqueda o explorá una de estas categorías." : "Usá el buscador para encontrar productos y ofertas."} actionLabel="Ver catálogo" actionHref="/products"><div className="mt-5 flex flex-wrap justify-center gap-2">{categories.map((category) => <Link key={category.id} href={categoryHref(category.slug)} className="cc-focus-ring min-h-11 rounded-full border border-cc-primary-border bg-cc-primary-soft px-3.5 py-2 text-[13px] font-semibold text-cc-primary transition-[background-color] duration-[var(--cc-duration-fast)] ease-cc-out hover:bg-cc-primary-softer">{category.name}</Link>)}</div></EmptyState></div>; }
  return <SearchResults query={query} products={products} />;
}
