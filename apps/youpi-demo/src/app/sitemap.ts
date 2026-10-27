import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://youpi-demo.vercel.app";

const routes = [
  "",
  "/store",
  "/checkout",
  "/outcomes",
  "/demo-pack",
  "/admin",
  "/admin/payments",
  "/admin/queue",
  "/admin/observers",
  "/admin/accounts",
  "/admin/branding",
  "/admin/webhooks",
  "/admin/security",
  "/admin/settings",
  "/docs",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${base}${route}/`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.6,
  }));
}
