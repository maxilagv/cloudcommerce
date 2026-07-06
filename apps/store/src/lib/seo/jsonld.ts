import type { ProductCardData } from "@/lib/catalog-types";
import { productHref } from "@/lib/catalog-types";
import type { ProductDetailData } from "@/lib/product-detail-types";
import { BASE_URL, SITE_NAME } from "./site";

/** Remove undefined/null/empty values from JSON-LD before serialization. */
export function removeEmpty<T>(input: T): T {
  if (Array.isArray(input)) {
    const filtered = (input as unknown[])
      .map(removeEmpty)
      .filter((v) => v !== undefined && v !== null && v !== "");
    return filtered as T;
  }
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .map(([k, v]) => [k, removeEmpty(v)])
        .filter(([, v]) => {
          if (v === undefined || v === null || v === "") return false;
          if (Array.isArray(v) && v.length === 0) return false;
          if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) return false;
          return true;
        }),
    ) as T;
  }
  return input;
}

/** Product images may be absolute API media URLs or local /public paths. */
function absoluteUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE_URL}${pathOrUrl}`;
}

/** Full Product JSON-LD for the PDP. */
export function buildProductJsonLd(product: ProductDetailData) {
  const canonical = `${BASE_URL}/products/${product.slug}`;
  const images = product.images.map(absoluteUrl);

  const additionalProperty = product.specs[0]?.rows.slice(0, 5).map((row) => ({
    "@type": "PropertyValue",
    name: row.label,
    value: row.value,
  }));

  const aggregateRating =
    product.reviewCount > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: product.rating,
          reviewCount: product.reviewCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined;

  const review = product.reviews?.map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.author },
    datePublished: r.date,
    name: r.title,
    reviewBody: r.body,
    reviewRating: {
      "@type": "Rating",
      ratingValue: r.rating,
      bestRating: 5,
      worstRating: 1,
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonical}#product`,
    name: product.name,
    description: product.longDescription,
    image: images,
    url: canonical,
    sku: product.sku,
    brand: product.brand
      ? {
          "@type": "Brand",
          name: product.brand,
        }
      : undefined,
    category: product.category,
    additionalProperty,
    aggregateRating,
    review,
    offers: {
      "@type": "Offer",
      "@id": `${canonical}#offer`,
      url: canonical,
      priceCurrency: "ARS",
      price: product.price,
      availability:
        product.stockStatus === "in-stock"
          ? "https://schema.org/InStock"
          : product.stockStatus === "soon"
            ? "https://schema.org/PreOrder"
            : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "AR",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 30,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingDestination: {
          "@type": "DefinedRegion",
          addressCountry: "AR",
        },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: {
            "@type": "QuantitativeValue",
            minValue: 0,
            maxValue: 1,
            unitCode: "DAY",
          },
          transitTime: {
            "@type": "QuantitativeValue",
            minValue: 1,
            maxValue: 3,
            unitCode: "DAY",
          },
        },
      },
    },
  };
}

/** BreadcrumbList JSON-LD. */
export function buildBreadcrumbJsonLd(
  items: { label: string; href?: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: item.href ? `${BASE_URL}${item.href}` : undefined,
    })),
  };
}

/**
 * ItemList JSON-LD for catalog/category listings — lets Google understand
 * the page as a product list and index the linked PDPs.
 */
export function buildItemListJsonLd(
  products: ProductCardData[],
  listUrl: string,
  listName: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${listUrl}#list`,
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 24).map((p, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${BASE_URL}${productHref(p)}`,
      name: p.name,
    })),
  };
}

/** Organization / OnlineStore. */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  "@id": `${BASE_URL}/#organization`,
  name: SITE_NAME,
  url: BASE_URL,
  logo: `${BASE_URL}/logo.svg`,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    areaServed: "AR",
    availableLanguage: ["es-AR"],
  },
};

/** WebSite + SearchAction (sitelinks searchbox). */
export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: SITE_NAME,
  url: BASE_URL,
  inLanguage: "es-AR",
  publisher: { "@id": `${BASE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};
