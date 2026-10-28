// Purpose: Root layout — header, footer, global styles

import type { Metadata } from "next";
import Link from "next/link";
import "../styles/globals.css";

const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME ?? "YouPI Store";
const TAGLINE = process.env.NEXT_PUBLIC_STORE_TAGLINE ?? "Everyday Indian wear, made to last";

export const metadata: Metadata = {
  title: { default: `${STORE_NAME} — ${TAGLINE}`, template: `%s · ${STORE_NAME}` },
  description: `${STORE_NAME}: everyday Indian wear. UPI se seedha merchant ke account me payment — koi payment gateway fee nahi.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <header className="site-header">
          <div className="container inner">
            <Link href="/" className="brand">
              <span className="brand-mark">YP</span>
              {STORE_NAME}
            </Link>
            <nav className="nav">
              <Link href="/products">Shop</Link>
              <Link href="/policies/shipping-policy">Shipping</Link>
              <Link href="/policies/refund-and-return-policy">Returns</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container inner">
            <span>
              © {new Date().getFullYear()} {STORE_NAME} · UPI payments settled directly to our own account
            </span>
            <span className="mono">Secured by a self-hosted UPI gateway</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
