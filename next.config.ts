import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingIncludes: {
    "/api/proposals/*/pdf": ["./fonts/**/*"],
  },
};

export default nextConfig;
