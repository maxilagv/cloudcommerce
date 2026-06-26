import type { Metadata } from "next";
import type { ProductDetailData } from "@/lib/mock-product-detail";

const BASE_URL = "https://www.cloudcommerce.com.ar";
const SITE_NAME = "cloudcommerce";

export const metadataBase = new URL(BASE_URL);

function productTitle(p: ProductDetailData): string {
  const spec = p.capacityVariants.find((c) => c.id === p.activeCapacity)?.label ?? "";
  return `${p.brand} ${p.name}${spec ? ` ${spec}` : ""} | Precio y envío en Argentina`;
}

function productDescription(p: ProductDetailData): string {
  const benefit = p.features[0] ?? "";
  return `Comprá ${p.brand} ${p.name} en ${SITE_NAME}. ${benefit}, precio en ARS, cuotas, stock actualizado y envío a Argentina.`;
}

export function buildProductMetadata(product: ProductDetailData): Metadata {
  const canonical = `${BASE_URL}/products/${product.slug}`;
  const imageUrl = `${BASE_URL}${product.image}`;

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
      title: `${product.brand} ${product.name}`,
      description: product.features.slice(0, 2).join(". "),
      url: canonical,
      images: [{ url: imageUrl, width: 800, height: 800, alt: product.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.brand} ${product.name}`,
      description: product.features.slice(0, 2).join(". "),
      images: [imageUrl],
    },
  };
}

export function buildCatalogMetadata(): Metadata {
  const canonical = `${BASE_URL}/`;
  return {
    metadataBase,
    title: `${SITE_NAME} | Tecnología, electrodomésticos y electrónica en Argentina`,
    description:
      "Encontrá tecnología, electrodomésticos y electrónica en cloudcommerce: compará marcas, precios, cuotas, stock, envío rápido y especificaciones para elegir mejor.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: SITE_NAME,
      description: "Tecnología y electrodomésticos al mejor precio en Argentina.",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME,
      description: "Tecnología y electrodomésticos al mejor precio en Argentina.",
    },
  };
}

export function buildNotFoundMetadata(): Metadata {
  return {
    title: `Producto no encontrado | ${SITE_NAME}`,
    robots: { index: false, follow: false },
  };
}
