import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: the dev server runs on dev01 and is opened over the tailnet,
  // so without these Next blocks /_next/* as cross-origin and nothing hydrates.
  allowedDevOrigins: ["dev01.tail157090.ts.net", "100.88.30.102"],
  pageExtensions: ["ts", "tsx", "mdx"],
  reactCompiler: true,
};

// The docs are MDX pages. Turbopack takes plugins by package name, with JSON options only.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-pretty-code", { theme: "vitesse-black", keepBackground: false }],
    ],
  },
});

export default withMDX(nextConfig);
