import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bookon/core"],
  poweredByHeader: false,
};

export default nextConfig;
