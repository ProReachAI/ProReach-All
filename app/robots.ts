import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: ["/dashboard", "/setup", "/api", "/auth"],
    },
    sitemap: "https://proreach.in/sitemap.xml",
    host: "https://proreach.in",
  };
}
