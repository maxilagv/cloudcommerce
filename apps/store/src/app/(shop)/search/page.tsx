import { SearchResults } from "@/components/product/search-results";
import { getStoreProducts } from "@/lib/api/catalog";

export const metadata = {
  title: "Buscar productos · CloudCommerce",
  robots: { index: false },
};

// Search depends on the request query string.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const products = query ? await getStoreProducts({ query, limit: 48 }) : [];
  return <SearchResults query={query} products={products} />;
}
