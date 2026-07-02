import type { Metadata } from "next";
import type { ProductDetailData } from "@/lib/mock-product-detail";

const BASE_URL = "https://www.cloudcommerce.com.ar";
const SITE_NAME = "cloudcommerce";

export const metadataBase = new URL(BASE_URL);

function productTitle(p: ProductDetailData): string {
  const spec = p.capacityVariants.find((c) => c.id === p.activeCapacity)?.label ?? "";
  return `${p.brand} ${p.name}${spec ? ` ${spec}` : ""} | Precio y envio en Argentina`;
}

function productDescription(p: ProductDetailData): string {
  const benefit = p.features[0] ?? "";
  return `Compra ${p.brand} ${p.name} en ${SITE_NAME}. ${benefit}, precio en ARS, stock actualizado, garantia oficial y envio a Argentina.`;
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

export function buildHomeMetadata(): Metadata {
  const canonical = `${BASE_URL}/`;
  return {
    metadataBase,
    title: `${SITE_NAME} | Tecnologia, electronica y electrodomesticos`,
    description:
      "Descubri electronica, electrodomesticos, celulares, TV, audio, computacion y hogar inteligente en cloudcommerce. Envios rapidos, garantia oficial y compra segura.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${SITE_NAME} | Tecnologia para tu hogar`,
      description:
        "Electronica y electrodomesticos con experiencia premium, envios rapidos, garantia oficial y soporte experto.",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} | Tecnologia para tu hogar`,
      description:
        "Electronica y electrodomesticos con experiencia premium, envios rapidos, garantia oficial y soporte experto.",
    },
  };
}

export function buildCatalogMetadata(): Metadata {
  const canonical = `${BASE_URL}/products`;
  return {
    metadataBase,
    title: `${SITE_NAME} | Tecnologia, electrodomesticos y electronica en Argentina`,
    description:
      "Encontra tecnologia, electrodomesticos y electronica en cloudcommerce: compara marcas, precios, stock, envio rapido y especificaciones para elegir mejor.",
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${SITE_NAME} | Catalogo de tecnologia`,
      description: "Tecnologia y electrodomesticos con envio rapido en Argentina.",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: `${SITE_NAME} | Catalogo de tecnologia`,
      description: "Tecnologia y electrodomesticos con envio rapido en Argentina.",
    },
  };
}

export function buildNotFoundMetadata(): Metadata {
  return {
    title: `Producto no encontrado | ${SITE_NAME}`,
    robots: { index: false, follow: false },
  };
}
