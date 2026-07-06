import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  Boxes,
  Headphones,
  Laptop,
  Layers,
  PackageCheck,
  PackageSearch,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  Tv,
  WashingMachine,
  Wifi,
} from "lucide-react";
import { hasRealImage, productHref, type ProductCardData } from "@/lib/catalog-types";
import type { StoreCategoryNode } from "@/lib/api/catalog";

/**
 * Home content builders. Everything visual (hero, brands, promos, collections,
 * featured) is derived from the live catalog; the only static strings are the
 * store's own editorial copy and service promises.
 */

export type HomeImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type HomeCategory = {
  id: string;
  title: string;
  description: string;
  href: string;
  image?: HomeImage;
  icon: LucideIcon;
  accent: "blue" | "cyan" | "neutral";
};

export type HomeBenefit = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type HomePromo = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  image?: HomeImage;
  tone: "blue" | "light" | "glass" | "success";
};

export type HomeBrand = {
  id: string;
  name: string;
  href: string;
};

export type HomeFeaturedProduct = {
  id: string;
  name: string;
  brand: string;
  slug: string;
  image: HomeImage;
  price: number;
  listPrice?: number;
  rating?: {
    value: number;
    count: number;
  };
  badge?: "En stock" | "Nuevo" | "Oferta" | "Destacado";
  href: string;
};

export type HomeCollection = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  image?: HomeImage;
};

export type HeroShowcaseImage = {
  id: string;
  src: string;
  alt: string;
  href: string;
  className: string;
  priority: boolean;
};

// ---------------------------------------------------------------------------
// Editorial copy (the store's own voice — not data)
// ---------------------------------------------------------------------------

export const homeHeroCopy = {
  eyebrow: "TECNOLOGÍA QUE TE MUEVE",
  title: "Tecnología que mejora tu vida en casa",
  description:
    "Descubrí electrónica y electrodomésticos premium con envío rápido, garantía oficial y atención experta.",
  primaryCta: "Descubrir ofertas",
  secondaryCta: "Ver categorías",
};

export const homeBenefits: HomeBenefit[] = [
  { id: "shipping", title: "Envíos rápidos 24-48h", description: "A todo el país", icon: Truck },
  { id: "safe", title: "Compra 100% segura", description: "Tus datos protegidos", icon: ShieldCheck },
  { id: "warranty", title: "Garantía oficial", description: "Productos originales", icon: BadgeCheck },
  { id: "returns", title: "Devoluciones fáciles", description: "Hasta 30 días", icon: RotateCcw },
  { id: "support", title: "Soporte experto", description: "Estamos para ayudarte", icon: Headphones },
];

export const homeTrustItems: HomeBenefit[] = [
  { id: "official", title: "Garantía oficial", description: "Productos 100% originales", icon: PackageCheck },
  { id: "brands", title: "Marcas líderes", description: "Seleccionadas por calidad", icon: Sparkles },
  { id: "safe", title: "Compra protegida", description: "Tus datos siempre seguros", icon: ShieldCheck },
  { id: "tracking", title: "Seguimiento en línea", description: "Tu pedido paso a paso", icon: PackageSearch },
  { id: "support", title: "Atención personalizada", description: "Respuesta rápida siempre", icon: Headphones },
];

// ---------------------------------------------------------------------------
// Hero showcase — floating composition built from real product images
// ---------------------------------------------------------------------------

/** Fixed art-directed slots; filled in order with real catalog images. */
const HERO_SLOTS = [
  "left-[18%] top-[7%] w-[46%] rotate-[-1deg]",
  "right-[5%] top-[16%] w-[27%]",
  "right-[26%] bottom-[2%] w-[24%]",
  "left-[5%] bottom-[8%] w-[32%]",
  "left-[41%] bottom-[8%] w-[15%]",
] as const;

export function buildHeroShowcase(products: ProductCardData[]): HeroShowcaseImage[] {
  return products
    .filter(hasRealImage)
    .slice(0, HERO_SLOTS.length)
    .map((product, i) => ({
      id: product.id,
      src: product.image,
      alt: product.imageAlt,
      href: productHref(product),
      className: HERO_SLOTS[i],
      priority: i === 0,
    }));
}

// ---------------------------------------------------------------------------
// Brands — derived from the live catalog, ordered by presence
// ---------------------------------------------------------------------------

export function buildHomeBrands(products: ProductCardData[]): HomeBrand[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    if (p.brand) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  }
  const brands = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([name]) => ({
      id: name.toLowerCase(),
      name,
      href: `/products?brand=${encodeURIComponent(name)}`,
    }));
  // A strip with one or two logos looks broken — hide until there's variety.
  return brands.length >= 3 ? brands : [];
}

// ---------------------------------------------------------------------------
// Promos — commercial modules backed by real discounts / arrivals
// ---------------------------------------------------------------------------

function toHomeImage(product: ProductCardData): HomeImage {
  return { src: product.image, alt: product.imageAlt, width: 320, height: 320 };
}

export function buildHomePromos(products: ProductCardData[]): HomePromo[] {
  const discounted = products
    .filter((p) => p.oldPrice != null && p.oldPrice > p.price)
    .sort(
      (a, b) =>
        (b.oldPrice! - b.price) / b.oldPrice! - (a.oldPrice! - a.price) / a.oldPrice!,
    );
  const bestDeal = discounted.find(hasRealImage) ?? discounted[0];
  const maxPct = bestDeal?.oldPrice
    ? Math.round(((bestDeal.oldPrice - bestDeal.price) / bestDeal.oldPrice) * 100)
    : 0;

  const newest = [...products]
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .find((p) => hasRealImage(p) && p.id !== bestDeal?.id);

  return [
    {
      id: "deal",
      eyebrow: "Ofertas reales",
      title: maxPct > 0 ? `Hasta ${maxPct}% OFF` : "Ofertas seleccionadas",
      description: "Descuentos vigentes sobre el precio de lista, sin letra chica.",
      href: "/products?deals=1",
      cta: "Ver ofertas",
      image: bestDeal && hasRealImage(bestDeal) ? toHomeImage(bestDeal) : undefined,
      tone: "blue",
    },
    {
      id: "arrivals",
      eyebrow: "Recién llegados",
      title: "Lo último del catálogo",
      description: "Novedades que acabamos de sumar para actualizar tu setup.",
      href: "/products?sort=newest",
      cta: "Explorar novedades",
      image: newest ? toHomeImage(newest) : undefined,
      tone: "light",
    },
    {
      id: "shipping",
      eyebrow: "Entrega inteligente",
      title: "Seguimiento en tiempo real",
      description: "Conocé el estado de tus envíos desde tu cuenta.",
      href: "/orders",
      cta: "Ver seguimiento",
      tone: "glass",
    },
    {
      id: "protected",
      eyebrow: "Compra protegida",
      title: "Seguridad y garantía oficial",
      description: "Productos originales, devoluciones simples y soporte experto.",
      href: "/products",
      cta: "Conocer productos",
      tone: "success",
    },
  ];
}

// ---------------------------------------------------------------------------
// Categories & collections — the real category tree drives both sections
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: LucideIcon[] = [Smartphone, WashingMachine, Tv, Laptop, Wifi, Headphones];
const CATEGORY_ACCENTS: HomeCategory["accent"][] = ["blue", "neutral", "cyan"];
const COLLECTION_ICONS: LucideIcon[] = [Layers, Boxes, Sparkles];

const SHOWCASE_LIMIT = 6;

/** Map real backend categories into the visual showcase cards (max 6 roots). */
export function buildHomeCategories(
  categories: StoreCategoryNode[],
  imageUrlFor: (imageId: string) => string,
): HomeCategory[] {
  return categories
    .filter((c) => c.isActive)
    .slice(0, SHOWCASE_LIMIT)
    .map((category, i) => ({
      id: category.id,
      title: category.name,
      description: category.description ?? "Ver productos de la categoría",
      href: `/products?category=${encodeURIComponent(category.slug)}`,
      image: category.imageId
        ? { src: imageUrlFor(category.imageId), alt: category.name, width: 320, height: 320 }
        : undefined,
      icon: CATEGORY_ICONS[i % CATEGORY_ICONS.length],
      accent: CATEGORY_ACCENTS[i % CATEGORY_ACCENTS.length],
    }));
}

/**
 * Collections = the categories that didn't fit in the showcase (extra roots
 * first, then subcategories). Hidden entirely when the tree is small.
 */
export function buildHomeCollections(
  categories: StoreCategoryNode[],
  imageUrlFor: (imageId: string) => string,
): HomeCollection[] {
  const roots = categories.filter((c) => c.isActive);
  const children = roots.flatMap((root) =>
    ((root.children ?? []) as StoreCategoryNode[]).filter((c) => c.isActive),
  );
  const extras = [...roots.slice(SHOWCASE_LIMIT), ...children];

  return extras.slice(0, 3).map((category, i) => ({
    id: category.id,
    title: category.name,
    description: category.description ?? `Explorá los productos de ${category.name}.`,
    href: `/products?category=${encodeURIComponent(category.slug)}`,
    icon: COLLECTION_ICONS[i % COLLECTION_ICONS.length],
    image: category.imageId
      ? { src: imageUrlFor(category.imageId), alt: category.name, width: 320, height: 320 }
      : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Featured products
// ---------------------------------------------------------------------------

const badgeByType = {
  stock: "En stock",
  new: "Nuevo",
  discount: "Oferta",
  soon: "Destacado",
} as const;

/** Map real catalog cards into the compact featured-product shape the home uses. */
export function buildHomeFeaturedProducts(products: ProductCardData[]): HomeFeaturedProduct[] {
  return products.slice(0, 8).map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    slug: product.slug ?? product.id,
    image: { src: product.image, alt: product.imageAlt, width: 320, height: 320 },
    price: product.price,
    listPrice: product.oldPrice,
    rating: product.reviewCount > 0 ? { value: product.rating, count: product.reviewCount } : undefined,
    badge: product.badge ? badgeByType[product.badge.type] : "Destacado",
    href: productHref(product),
  }));
}
