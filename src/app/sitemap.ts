import type { MetadataRoute } from "next";
import { liveLessonPaths } from "@/lib/lessons";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Derived from the shared lesson registry so new lessons appear automatically.
const staticRoutes: readonly string[] = ["", "/lessons", ...liveLessonPaths];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return staticRoutes.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority: path === "" ? 1.0 : 0.8,
  }));
}
