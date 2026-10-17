import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bookon/core", "@bookon/db"],
  // PGlite ships WebAssembly and is only used in tests, so keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
};

export default nextConfig;
