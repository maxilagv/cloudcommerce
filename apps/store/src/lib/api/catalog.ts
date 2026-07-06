import { cache } from "react";
import { StockStatus } from "@cloudcommerce/types";
import { API_URL, trpc, type RouterOutputs } from "@/lib/trpc";
import { PLACEHOLDER_PRODUCT_IMAGE, type ProductCardData } from "@/lib/catalog-types";
import type { ProductDetailData, SpecSection } from "@/lib/product-detail-types";

/**
 * Adapter layer: fetches the real catalog (apps/api via tRPC) and maps the
 * backend contracts into the UI shapes the store components already consume
 * (`ProductCardData` / `ProductDetailData`). Every fetcher swallows network
 * errors and returns an empty result so pages/builds never crash when the
 * API is down.
 */

export type StoreProductCard = RouterOutputs["store"]["products"]["list"]["items"][number];
export type StoreProductDetail = RouterOutputs["store"]["products"]["bySlug"];
export type StoreCategoryNode = RouterOutputs["store"]["categories"][number];

export { PLACEHOLDER_PRODUCT_IMAGE };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Public, cacheable image URL served by the API. */
export function mediaUrl(mediaAssetId: string): string {
  return `${API_URL}/media/public/${mediaAssetId}`;
}

/** amountMinor is in centavos — the UI works in whole pesos. */
function toPesos(amountMinor: number): number {
  return Math.round(amountMinor / 100);
}

function badgeFor(card: StoreProductCard): ProductCardData["badge"] {
  const price = card.price?.amountMinor ?? 0;
  const compareAt = card.compareAtPrice?.amountMinor ?? 0;
  if (compareAt > price && price > 0) {
    const pct = Math.round(((compareAt - price) / compareAt) * 100);
    return { type: "discount", label: `-${pct}%` };
  }
  if (card.stockStatus === StockStatus.SOON) {
    return { type: "soon", label: "Pronto" };
  }
  if (Date.now() - new Date(card.createdAt).getTime() <= THIRTY_DAYS_MS) {
    return { type: "new", label: "Nuevo" };
  }
  return undefined;
}

export function mapCardToUi(card: StoreProductCard): ProductCardData {
  return {
    id: card.id,
    slug: card.slug,
    brand: card.brand?.name ?? "",
    name: card.title,
    sku: card.sku ?? undefined,
    category: card.category?.name ?? "",
    image: card.mainImage ? mediaUrl(card.mainImage.id) : PLACEHOLDER_PRODUCT_IMAGE,
    imageAlt: card.mainImage?.altText ?? card.title,
    badge: badgeFor(card),
    rating: 0,
    reviewCount: 0,
    features: [],
    price: card.price ? toPesos(card.price.amountMinor) : 0,
    oldPrice: card.compareAtPrice ? toPesos(card.compareAtPrice.amountMinor) : undefined,
    wholesale: card.wholesale
      ? {
          minQuantity: card.wholesale.minQuantity,
          price: toPesos(card.wholesale.price.amountMinor),
        }
      : null,
    shipping: "free",
    stockStatus:
      card.stockStatus === StockStatus.OUT_OF_STOCK
        ? "out-of-stock"
        : card.stockStatus === StockStatus.SOON
          ? "soon"
          : "in-stock",
    createdAt: new Date(card.createdAt).toISOString(),
  };
}

function specValue(item: StoreProductDetail["specs"][number]["items"][number]): string {
  if (item.valueText) return item.valueText;
  if (item.valueNum != null) return `${item.valueNum}${item.unit ? ` ${item.unit}` : ""}`;
  return "—";
}

function descriptionBullets(description: string): string[] {
  const lines = description
    .split(/\r?\n+/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  const source = lines.length > 1 ? lines : description.split(/(?<=\.)\s+/).map((s) => s.trim()).filter(Boolean);
  return source.slice(0, 6);
}

const DEFAULT_SERVICES: ProductDetailData["services"] = [
  {
    icon: "shield",
    title: "Garantía oficial",
    body: "Producto original con garantía de fábrica gestionada por CloudCommerce.",
  },
  {
    icon: "truck",
    title: "Envío a todo el país",
    body: "Despacho asegurado con seguimiento hasta tu puerta.",
  },
  {
    icon: "rotate",
    title: "Devolución 30 días",
    body: "Si no quedás satisfecho, coordinamos el retiro y el reembolso total.",
  },
];

export function mapDetailToUi(detail: StoreProductDetail): ProductDetailData {
  const card = mapCardToUi(detail);

  const images = [...detail.media]
    .sort((a, b) => a.position - b.position)
    .map((m) => mediaUrl(m.mediaAssetId));

  const specs: SpecSection[] = [...detail.specs]
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      category: group.name,
      rows: [...group.items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({ label: item.label, value: specValue(item) })),
    }))
    .filter((section) => section.rows.length > 0);

  const variants = detail.variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.position - b.position);

  const bullets = detail.description ? descriptionBullets(detail.description) : [];

  return {
    ...card,
    variantId: variants[0]?.id,
    slug: detail.slug,
    images: images.length > 0 ? images : [card.image],
    colorVariants: [],
    capacityVariants: variants.map((v) => ({ id: v.id, label: v.title })),
    activeColor: "",
    activeCapacity: variants[0]?.id ?? "",
    specs,
    longDescription: detail.description ?? "",
    descriptionBullets: bullets,
    services: DEFAULT_SERVICES,
    reviews: [],
    reviewDistribution: [],
    questions: [],
    breadcrumb: [
      { label: "Inicio", href: "/" },
      { label: "Catálogo", href: "/products" },
      ...(detail.category
        ? [{ label: detail.category.name, href: `/products?category=${encodeURIComponent(detail.category.slug)}` }]
        : []),
      ...(detail.brand
        ? [{ label: detail.brand.name, href: `/products?brand=${encodeURIComponent(detail.brand.name)}` }]
        : []),
      { label: detail.title },
    ],
  };
}

// ---------------------------------------------------------------------------
// Category tree helpers
// ---------------------------------------------------------------------------

/** Depth-first flatten of the category tree (roots first, then children). */
export function flattenCategories(nodes: StoreCategoryNode[]): StoreCategoryNode[] {
  const out: StoreCategoryNode[] = [];
  const walk = (list: StoreCategoryNode[]) => {
    for (const node of list) {
      out.push(node);
      if (node.children?.length) walk(node.children as StoreCategoryNode[]);
    }
  };
  walk(nodes);
  return out;
}

/** Resolve a category anywhere in the tree by its URL slug. */
export function findCategoryBySlug(
  nodes: StoreCategoryNode[],
  slug: string | undefined,
): StoreCategoryNode | undefined {
  if (!slug) return undefined;
  return flattenCategories(nodes).find((c) => c.slug === slug && c.isActive);
}

// ---------------------------------------------------------------------------
// Fetchers — never throw: the store must render with empty states offline.
// ---------------------------------------------------------------------------

export async function getStoreProducts(options?: {
  query?: string;
  categoryId?: string;
  limit?: number;
}): Promise<ProductCardData[]> {
  try {
    const result = await trpc.store.products.list.query({
      query: options?.query || undefined,
      categoryId: options?.categoryId,
      limit: options?.limit ?? 24,
      sort: "created_desc",
    });
    return result.items.map(mapCardToUi);
  } catch {
    return [];
  }
}

export const getStoreCategories = cache(async (): Promise<StoreCategoryNode[]> => {
  try {
    return await trpc.store.categories.query();
  } catch {
    return [];
  }
});

export const getProductDetailBySlug = cache(
  async (slug: string): Promise<ProductDetailData | null> => {
    try {
      const detail = await trpc.store.products.bySlug.query({ slug });
      return mapDetailToUi(detail);
    } catch {
      return null;
    }
  },
);

/** Walk the cursor pagination to gather the catalog for the sitemap. */
export async function getAllProductsForSitemap(max = 480): Promise<ProductCardData[]> {
  const out: ProductCardData[] = [];
  let cursor: string | undefined;
  try {
    while (out.length < max) {
      const page = await trpc.store.products.list.query({
        limit: 48,
        cursor,
        sort: "created_desc",
      });
      out.push(...page.items.map(mapCardToUi));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
  } catch {
    // Partial result is fine — the sitemap still renders what we have.
  }
  return out.slice(0, max);
}

export async function autocompleteProducts(query: string): Promise<ProductCardData[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  try {
    const cards = await trpc.store.products.autocomplete.query({ query: trimmed });
    return cards.map(mapCardToUi);
  } catch {
    return [];
  }
}

/** Info pública del programa CloudPoints (tasa) — para el bloque de la PDP. */
export const getLoyaltyProgram = cache(
  async (): Promise<{ pointsPer1000: number; isEnabled: boolean } | null> => {
    try {
      return await trpc.loyalty.rewards.program.query();
    } catch {
      return null;
    }
  },
);
