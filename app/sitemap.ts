import type { MetadataRoute } from "next";
import { listOpenMatches } from "@/services/matches/service";

const SITE_URL = "https://www.padelya.co";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/matches`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/players`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/refund-policy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const matches = await listOpenMatches();
    const matchRoutes: MetadataRoute.Sitemap = matches.map((m) => ({
      url: `${SITE_URL}/matches/${m.id}`,
      lastModified: m.scheduledAt ? new Date(m.scheduledAt) : undefined,
      changeFrequency: "hourly",
      priority: 0.7,
    }));
    return [...staticRoutes, ...matchRoutes];
  } catch {
    // If the DB is unavailable at build/runtime, ship the static routes.
    return staticRoutes;
  }
}
