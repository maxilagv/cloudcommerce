import type { ProductDetailData } from "@/lib/mock-product-detail";

const BASE_URL = "https://www.cloudcommerce.com.ar";

/** Remove undefined/null/empty values from JSON-LD before serialization — skill §12.1 */
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

/** Full Product JSON-LD — skill §12 */
export function buildProductJsonLd(product: ProductDetailData) {
  const canonical = `${BASE_URL}/products/${product.slug}`;
  const images = product.images.map((img) => `${BASE_URL}${img}`);

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
    brand: {
      "@type": "Brand",
      name: product.brand,
    },
    color: product.colorVariants.find((c) => c.id === product.activeColor)?.label,
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
        name: "cloudcommerce",
      },
      hasMerchantReturnPolicy:
        product.shipping === "free"
          ? {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "AR",
              returnPolicyCategory:
                "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: 30,
              returnMethod: "https://schema.org/ReturnByMail",
              returnFees: "https://schema.org/FreeReturn",
            }
          : undefined,
      shippingDetails:
        product.shipping === "free"
          ? {
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
              shippingRate: {
                "@type": "MonetaryAmount",
                value: 0,
                currency: "ARS",
              },
            }
          : undefined,
    },
  };
}

/** BreadcrumbList JSON-LD — skill §13 */
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

/** Organization / OnlineStore — skill §15 */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "OnlineStore",
  "@id": `${BASE_URL}/#organization`,
  name: "cloudcommerce",
  url: BASE_URL,
  logo: `${BASE_URL}/logo-cloudcommerce.svg`,
  sameAs: [
    "https://www.instagram.com/cloudcommerce",
    "https://www.linkedin.com/company/cloudcommerce",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    areaServed: "AR",
    availableLanguage: ["es-AR"],
  },
};

/** WebSite + SearchAction — skill §14 */
export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${BASE_URL}/#website`,
  name: "cloudcommerce",
  url: BASE_URL,
  inLanguage: "es-AR",
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};
