import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/seo/site";

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
          "/compare",
          "/search",
          "/login",
          "/register",
          "/*?sort=",
          "/*?session=",
          "/*?utm_",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
