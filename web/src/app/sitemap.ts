import type { MetadataRoute } from "next";

const SITE = "https://shipcut.dev";
const PATHS = [
  "/",
  "/docs",
  "/docs/scenarios",
  "/docs/commands",
  "/docs/publishing",
  "/docs/agents",
  "/docs/faq",
  "/changelog",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${SITE}${path === "/" ? "" : path}` }));
}
