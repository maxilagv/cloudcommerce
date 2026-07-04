import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The shared UI library ships as source (.tsx); Next transpiles it.
  transpilePackages: ["@cloudcommerce/ui"],
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
