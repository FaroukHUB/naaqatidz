import type { MetadataRoute } from "next";
import { content } from "@/lib/catalog";
import { publicEnv } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const entries = await content.listSitemapEntries().catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/boutique`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/devenir-revendeur`, changeFrequency: "yearly", priority: 0.4 },
    ...entries.map((e) => ({ url: `${base}${e.path}`, lastModified: e.updatedAt ?? undefined })),
  ];
}
