import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STATIC_EXPORT === "1" ? "export" : undefined,
  poweredByHeader: false,
};

export default nextConfig;
