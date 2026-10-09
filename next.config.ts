import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const cloudflareStub = path.join(root, "lib/cloudflare-workers-stub.ts");

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "cloudflare:workers": "./lib/cloudflare-workers-stub.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, "cloudflare:workers": cloudflareStub };
    return config;
  },
};

export default nextConfig;
