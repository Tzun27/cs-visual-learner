import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const staticRoutes = [
  "",
  "/lessons",
  "/lessons/sorting/bubble-sort",
  "/lessons/sorting/heap-sort",
  "/lessons/sorting/insertion-sort",
  "/lessons/sorting/merge-sort",
  "/lessons/sorting/quick-sort",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return staticRoutes.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: path === "" ? 1.0 : 0.8,
  }));
}
