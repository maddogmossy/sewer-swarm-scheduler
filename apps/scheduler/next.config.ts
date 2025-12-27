import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(__dirname),
      "@shared": path.resolve(__dirname, "shared"),
    };
    return config;
  },
};

export default nextConfig;

