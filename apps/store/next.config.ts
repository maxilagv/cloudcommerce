import type { NextConfig } from "next";

// Product/category images are served by the API — its host must be
// allow-listed for next/image. Derived from NEXT_PUBLIC_API_URL so dev and
// production work without touching this file.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(":", "") as "http" | "https",
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: "/media/public/**",
      },
    ],
  },
};

export default nextConfig;
