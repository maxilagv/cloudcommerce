import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Visual catalog build uses local placeholder images in /public, so the
  // image optimizer stays hermetic (no outbound fetches in this container).
  // When real product photos move to a CDN, add remotePatterns here.
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
