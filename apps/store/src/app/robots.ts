import type { MetadataRoute } from "next";

const BASE_URL = "https://www.cloudcommerce.com.ar";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/cart",
          "/checkout",
          "/account",
          "/orders",
          "/search",
          "/*?sort=",
          "/*?session=",
          "/*?utm_",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
