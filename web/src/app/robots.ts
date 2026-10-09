import type { MetadataRoute } from "next";

// Everything on shipcut.dev may be crawled; the sitemap lists the pages.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://shipcut.dev/sitemap.xml",
  };
}
