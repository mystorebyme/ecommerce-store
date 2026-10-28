// Purpose: Next.js config — storefront server-side se API baat karta hai
//
// Browser kabhi API ko direct nahi chhoota: `/api/gateway/*` route handler usko
// server-side proxy karta hai. Isse CORS ki zarurat nahi padti aur API ka URL
// browser me expose nahi hota.

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "x-content-type-options", value: "nosniff" },
          { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
