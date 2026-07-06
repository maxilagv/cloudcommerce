/**
 * Single source of truth for site identity used across SEO surfaces
 * (metadata, JSON-LD, sitemap, robots, manifest, OG images).
 */

export const SITE_NAME = "CloudCommerce";

export const SITE_TAGLINE = "Tecnología que eleva tu vida";

export const SITE_DESCRIPTION =
  "Electrónica, electrodomésticos, celulares, TV, audio y hogar inteligente con envíos rápidos a todo el país, garantía oficial y compra 100% segura.";

/** Canonical origin — override per environment with NEXT_PUBLIC_SITE_URL. */
export const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.cloudcommerce.com.ar"
).replace(/\/+$/, "");

export const BRAND_COLOR = "#0B6BFF";
