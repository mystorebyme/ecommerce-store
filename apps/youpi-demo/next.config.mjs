/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static demo build: every flow runs in the browser, so the suite can be
  // hosted on Vercel's free tier (or any static host) without a backend.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
