import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship compiled JS in dist, so nothing needs transpiling here.
  poweredByHeader: false,
};

export default nextConfig;
