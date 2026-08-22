import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mobydick/design-system"],
  typedRoutes: true,
};

export default nextConfig;
