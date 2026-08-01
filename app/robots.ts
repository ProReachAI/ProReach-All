import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/app-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = appOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: ["/dashboard", "/setup", "/api", "/auth"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
