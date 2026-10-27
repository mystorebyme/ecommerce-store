"use client";

import Link from "next/link";
import { useState } from "react";
import { useDemo } from "@/lib/store";
import { Icon, Logo } from "./ui";

const columns = [
  {
    title: "Demo",
    links: [
      { href: "/store", label: "Merchant store" },
      { href: "/checkout", label: "Checkout flow" },
      { href: "/outcomes", label: "Outcome pages" },
      { href: "/demo-pack", label: "Demo pack" },
    ],
  },
  {
    title: "Operate",
    links: [
      { href: "/admin", label: "Admin console" },
      { href: "/admin/payments", label: "Payments ledger" },
      { href: "/admin/observers", label: "Observer mesh" },
      { href: "/admin/webhooks", label: "Webhook log" },
    ],
  },
  {
    title: "Build",
    links: [
      { href: "/docs", label: "Integration guide" },
      { href: "/docs#sdk", label: "SDK reference" },
      { href: "/docs#webhooks", label: "Webhook contract" },
      { href: "/docs#checklist", label: "Go-live checklist" },
    ],
  },
];

export function SiteFooter() {
  const { resetDemo } = useDemo();
  const [confirming, setConfirming] = useState(false);

  return (
    <footer className="mt-16 border-t border-line bg-paper-deep/60">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-ink-mute">
              A working, hand-built demo of the YouPI payment gateway: WhatsApp OTP authentication, dynamic UPI
              QR, a single-slot FIFO queue and observer-verified settlement.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">
                <Icon name="lock" className="h-3.5 w-3.5" /> Sandbox only
              </span>
              <span className="chip">
                <Icon name="wallet" className="h-3.5 w-3.5" /> Integer paise
              </span>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="label">{column.title}</p>
              <ul className="mt-2.5 space-y-1.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-[12.5px] text-ink-soft transition hover:text-brand">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-line pt-5 text-[11.5px] text-ink-mute sm:flex-row sm:items-center sm:justify-between">
          <p>
            Demo build · no real money moves · no bank, UPI or merchant accounts are connected. Inspired by the
            open-source YouPI PG project, rebuilt with its own branding, copy and UI.
          </p>
          {confirming ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetDemo();
                  setConfirming(false);
                }}
                className="rounded-full border border-bad px-3 py-1 text-[11px] font-semibold text-bad"
              >
                Yes, reset
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="text-[11px] underline">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="inline-flex items-center gap-1.5 self-start rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft hover:text-ink"
            >
              <Icon name="refresh" className="h-3.5 w-3.5" />
              Reset demo data
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
