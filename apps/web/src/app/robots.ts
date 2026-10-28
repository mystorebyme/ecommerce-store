// Purpose: robots.txt — checkout aur account pages crawl na hon

import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/checkout", "/account", "/api/"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
