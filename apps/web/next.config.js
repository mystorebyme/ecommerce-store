// Purpose: Next.js config — storefront performance + same-origin API
//
// Browser `/api/*` hi chhoota hai (same-origin, koi CORS nahi), par wo request
// **edge rewrite** se seedha API par jaati hai — beech me storefront ka koi function
// nahi chalta. Isse har order/payment call par ek poora lambda hop (~100-300ms) bachta hai.
//
// `API_URL` sirf server par padha jaata hai, browser bundle me nahi jaata.

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  async rewrites() {
    return [
      { source: "/api/orders", destination: `${API_URL}/api/v1/orders` },
      { source: "/api/orders/:path*", destination: `${API_URL}/api/v1/orders/:path*` },
      { source: "/api/payments", destination: `${API_URL}/api/v1/payments` },
      { source: "/api/payments/:path*", destination: `${API_URL}/api/v1/payments/:path*` },
      { source: "/api/products", destination: `${API_URL}/api/v1/products` },
      { source: "/api/products/:path*", destination: `${API_URL}/api/v1/products/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "x-content-type-options", value: "nosniff" },
          { key: "x-frame-options", value: "SAMEORIGIN" },
          { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Static assets: 1 saal immutable (hashed filenames).
        source: "/_next/static/:path*",
        headers: [{ key: "cache-control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Checkout/payment pages kabhi cache na hon (status live hai).
        // Ye pehle middleware me tha — middleware hata diya, kyunki wo har request par
        // ek extra edge invocation karta tha (headers yahin lag sakte hain).
        source: "/checkout/:path*",
        headers: [{ key: "cache-control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/checkout",
        headers: [{ key: "cache-control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

module.exports = nextConfig;
