import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { DemoProvider } from "@/lib/store";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const display = localFont({
  src: "../../public/fonts/sora.woff2",
  variable: "--font-display",
  weight: "100 800",
  display: "swap",
});

const body = localFont({
  src: "../../public/fonts/dm-sans.woff2",
  variable: "--font-body",
  weight: "100 1000",
  display: "swap",
});

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
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
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
