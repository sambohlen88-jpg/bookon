import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bookon/core", "@bookon/db", "@bookon/email"],
  // PGlite ships WebAssembly and is only used in tests, so keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite", "web-push", "sharp"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Browsers must always check for a new service worker.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
