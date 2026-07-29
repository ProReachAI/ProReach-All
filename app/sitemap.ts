import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: "https://proreach.in", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://proreach.in/privacy", lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: "https://proreach.in/terms", lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
