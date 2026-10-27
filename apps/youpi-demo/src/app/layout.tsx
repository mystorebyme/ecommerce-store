import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DemoProvider } from "@/lib/store";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "YouPI Payments — Live Demo Suite",
    template: "%s · YouPI Payments Demo",
  },
  description:
    "A working YouPI payment-gateway demo: WhatsApp OTP auth, dynamic UPI QR, FIFO payment queue, bank observer verification, signed webhooks, merchant admin console and full integration docs.",
  keywords: [
    "YouPI",
    "UPI payment gateway demo",
    "self hosted payments",
    "WhatsApp OTP checkout",
    "dynamic UPI QR",
    "merchant admin panel",
  ],
  openGraph: {
    title: "YouPI Payments — Live Demo Suite",
    description:
      "Click through the whole YouPI payment flow — checkout, QR, verification, outcomes, admin console and webhooks.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B5E4F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <DemoProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </DemoProvider>
      </body>
    </html>
  );
}
