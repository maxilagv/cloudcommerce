import type { MetadataRoute } from "next";
import {
  flattenCategories,
  getAllProductsForSitemap,
  getStoreCategories,
} from "@/lib/api/catalog";
import { BASE_URL } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Fetchers never throw (they return [] when the API is down), so the build
  // always succeeds even without a running backend.
  const [products, categories] = await Promise.all([
    getAllProductsForSitemap(),
    getStoreCategories(),
  ]);

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${BASE_URL}/products/${p.slug ?? p.id}`,
    lastModified: p.createdAt ? new Date(p.createdAt) : new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = flattenCategories(categories)
    .filter((c) => c.isActive)
    .map((c) => ({
      url: `${BASE_URL}/products?category=${encodeURIComponent(c.slug)}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...categoryEntries,
    ...productEntries,
  ];
}
