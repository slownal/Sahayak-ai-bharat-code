import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App Router only — disable Pages Router entirely
  // This prevents the spurious _document PageNotFoundError on Windows
  pageExtensions: ["tsx", "ts", "jsx", "js"],
  // Allow large image payloads for textbook page uploads
  experimental: {},
  // Headers for PWA service worker scope
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

