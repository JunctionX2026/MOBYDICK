import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mobydick/design-system", "@mobydick/icon"],
  typedRoutes: true,
  compiler: {
    relay: {
      src: "./src",
      artifactDirectory: "./src/__generated__/relay",
      language: "typescript",
    },
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
