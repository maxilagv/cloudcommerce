import type { Metadata } from "next";
import type { ProductDetailData } from "@/lib/product-detail-types";
import { BASE_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "./site";

export const metadataBase = new URL(BASE_URL);

/** Product images may already be absolute (API media URLs) or local /public paths. */
function absoluteImageUrl(src: string): string {
  return src.startsWith("http") ? src : `${BASE_URL}${src}`;
}

// ---------------------------------------------------------------------------
// Product (PDP)
// ---------------------------------------------------------------------------

function productTitle(p: ProductDetailData): string {
  const spec = p.capacityVariants.find((c) => c.id === p.activeCapacity)?.label ?? "";
  const brand = p.brand ? `${p.brand} ` : "";
  return `${brand}${p.name}${spec ? ` ${spec}` : ""} | Precio y envío en Argentina | ${SITE_NAME}`;
}

function productDescription(p: ProductDetailData): string {
  const benefit = p.descriptionBullets[0] ? `${p.descriptionBullets[0]}. ` : "";
  return `Comprá ${p.brand ? `${p.brand} ` : ""}${p.name} online en ${SITE_NAME}. ${benefit}Precio en pesos, stock real, garantía oficial y envío rápido a todo el país.`.slice(0, 300);
}

function shortDescription(p: ProductDetailData): string {
  return (
    p.descriptionBullets.slice(0, 2).join(". ") ||
    p.longDescription.slice(0, 160) ||
    productDescription(p)
  );
}

export function buildProductMetadata(product: ProductDetailData): Metadata {
  const canonical = `${BASE_URL}/products/${product.slug}`;
  const imageUrl = absoluteImageUrl(product.image);
  const ogTitle = `${product.brand ? `${product.brand} ` : ""}${product.name}`;

  return {
    metadataBase,
    title: productTitle(product),
    description: productDescription(product),
    alternates: { canonical },
    robots: {
      index: product.stockStatus !== "out-of-stock",
      follow: true,
      googleBot: {
        index: product.stockStatus !== "out-of-stock",
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: ogTitle,
      description: shortDescription(product),
      url: canonical,
      images: [{ url: imageUrl, width: 800, height: 800, alt: product.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: shortDescription(product),
      images: [imageUrl],
    },
  };
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export function buildHomeMetadata(): Metadata {
  const canonical = `${BASE_URL}/`;
  const title = `${SITE_NAME} | Tecnología, electrónica y electrodomésticos`;
  return {
    metadataBase,
    title,
    description: `${SITE_DESCRIPTION} Descubrí el catálogo completo en ${SITE_NAME}.`,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${SITE_NAME} | ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} | ${SITE_TAGLINE}`,
      description: SITE_DESCRIPTION,
    },
  };
}

// ---------------------------------------------------------------------------
// Catalog (/products) — with SEO landing variants per category/brand/deals
// ---------------------------------------------------------------------------

export type CatalogMetadataInput = {
  category?: {
    name: string;
    slug: string;
    seoTitle?: string | null;
    seoDescription?: string | null;
  };
  brand?: string;
  deals?: boolean;
  query?: string;
};

export function buildCatalogMetadata(input: CatalogMetadataInput = {}): Metadata {
  const { category, brand, deals, query } = input;

  let canonical = `${BASE_URL}/products`;
  let title = `Catálogo de tecnología, electrodomésticos y electrónica | ${SITE_NAME}`;
  let description = `Encontrá tecnología, electrodomésticos y electrónica en ${SITE_NAME}: compará marcas, precios, stock y especificaciones con envío rápido en Argentina.`;

  if (category) {
    canonical = `${BASE_URL}/products?category=${encodeURIComponent(category.slug)}`;
    title = category.seoTitle?.trim()
      ? `${category.seoTitle.trim()} | ${SITE_NAME}`
      : `${category.name} | Precios y stock en Argentina | ${SITE_NAME}`;
    description = category.seoDescription?.trim()
      ? category.seoDescription.trim()
      : `Comprá ${category.name} online en ${SITE_NAME}. Stock real, garantía oficial, envío rápido a todo el país y compra 100% protegida.`;
  } else if (brand) {
    canonical = `${BASE_URL}/products?brand=${encodeURIComponent(brand)}`;
    title = `${brand}: productos, precios y stock | ${SITE_NAME}`;
    description = `Todos los productos ${brand} disponibles en ${SITE_NAME}, con garantía oficial, stock actualizado y envío rápido en Argentina.`;
  } else if (deals) {
    canonical = `${BASE_URL}/products?deals=1`;
    title = `Ofertas de tecnología y electrodomésticos | ${SITE_NAME}`;
    description = `Descuentos reales sobre precio de lista en tecnología y electrodomésticos. Aprovechá las ofertas vigentes de ${SITE_NAME} con envío rápido.`;
  }

  // Free-text searches inside the catalog never get indexed.
  const index = !query;

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical },
    robots: {
      index,
      follow: true,
      googleBot: { index, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function buildNotFoundMetadata(): Metadata {
  return {
    title: `Producto no encontrado | ${SITE_NAME}`,
    robots: { index: false, follow: false },
  };
}
