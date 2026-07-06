/**
 * Canonical UI shapes for the store catalog.
 *
 * `ProductCardData` is the shape every card/grid/drawer component consumes.
 * Instances are produced exclusively from real backend data by
 * `lib/api/catalog.ts` (`mapCardToUi`) — there is no mock catalog.
 */

export type ProductCardData = {
  /** Backend product id (uuid) — required by checkout. */
  id: string;
  /** URL slug for the PDP (`/products/{slug}`). Falls back to `id` when absent. */
  slug?: string;
  /** Default (active) variant id — carried into the cart for checkout. */
  variantId?: string;
  brand: string;
  name: string;
  sku?: string;
  category: string;
  image: string;
  imageAlt: string;
  badge?: {
    type: "stock" | "discount" | "new" | "soon";
    label: string;
  };
  rating: number;
  reviewCount: number;
  features: string[];
  price: number;
  oldPrice?: number;
  shipping?: "free" | "paid" | "pickup";
  stockStatus: "in-stock" | "soon" | "out-of-stock";
  isFavorite?: boolean;
  /** ISO date the product entered the catalog — drives "Nuevo" badges and the newest sort. */
  createdAt?: string;
  /** Precio mayorista por cantidad (modo reventa): desde `minQuantity` unidades. */
  wholesale?: {
    minQuantity: number;
    price: number;
  } | null;
};

/**
 * Precio unitario según la cantidad elegida. Espeja la lógica del backend
 * (el server siempre re-cotiza en el checkout — esto es solo display).
 */
export function unitPriceFor(
  product: Pick<ProductCardData, "price" | "wholesale">,
  quantity: number,
): number {
  if (product.wholesale && quantity >= product.wholesale.minQuantity) {
    return Math.min(product.wholesale.price, product.price);
  }
  return product.price;
}

/** Canonical PDP link for a product card (slug when known, id otherwise). */
export function productHref(product: Pick<ProductCardData, "id" | "slug">): string {
  return `/products/${product.slug ?? product.id}`;
}

/** Neutral local asset shown when a product has no image yet. */
export const PLACEHOLDER_PRODUCT_IMAGE = "/product-placeholder.svg";

/** True when the card carries a real (non-placeholder) image. */
export function hasRealImage(product: Pick<ProductCardData, "image">): boolean {
  return product.image !== PLACEHOLDER_PRODUCT_IMAGE;
}

/** Availability facets offered by the catalog filters. */
export const availabilityOptions: { id: string; label: string }[] = [
  { id: "in-stock", label: "En stock" },
  { id: "deals", label: "En oferta" },
];

/** Lightweight category reference used by catalog navigation (chips/sidebar). */
export type CategoryLink = {
  label: string;
  slug: string;
};

/** Canonical catalog URL for a category (crawlable SEO landing). */
export function categoryHref(slug: string): string {
  return `/products?category=${encodeURIComponent(slug)}`;
}
