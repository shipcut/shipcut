import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: the dev server runs on dev01 and is opened over the tailnet,
  // so without these Next blocks /_next/* as cross-origin and nothing hydrates.
  allowedDevOrigins: ["dev01.tail157090.ts.net", "100.88.30.102"],
  reactCompiler: true,
};

export default nextConfig;
