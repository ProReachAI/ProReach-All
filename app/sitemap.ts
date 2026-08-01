import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/app-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = appOrigin();
  const lastModified = new Date();
  return [
    { url: origin, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${origin}/data-deletion`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
