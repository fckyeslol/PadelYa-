import type { MetadataRoute } from "next";

const SITE_URL = "https://www.padelya.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / non-indexable surfaces.
      disallow: ["/api/", "/cancha", "/auth/", "/profile", "/payments", "/organizer"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
