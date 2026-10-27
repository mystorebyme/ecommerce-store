"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/format";
import { Icon, Logo } from "./ui";
import { useDemo } from "@/lib/store";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/store", label: "Demo store" },
  { href: "/checkout", label: "Checkout" },
  { href: "/outcomes", label: "Outcomes" },
  { href: "/admin", label: "Admin console" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { state } = useDemo();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-line/90 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-5 py-3 sm:px-8">
        <Link href="/" className="shrink-0" aria-label="YouPI demo home">
          <Logo />
        </Link>

        <span className="hidden rounded-full border border-[#BBDFCE] bg-[#EDF7F1] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-ok sm:inline-flex">
          Sandbox
        </span>

        <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition",
                isActive(item.href)
                  ? "bg-ink text-white"
                  : "text-ink-soft hover:bg-paper-deep hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] text-ink-mute sm:inline-flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-ok" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
            </span>
            {state.sessions.filter((s) => s.status === "ACTIVE" || s.status === "PROCESSING").length > 0
              ? "Slot in use"
              : "No live slot"}
          </span>
          <Link href="/store" className="btn-primary !px-3.5 !py-2 !text-[12.5px]">
            <Icon name="qr" className="h-4 w-4" />
            <span className="hidden sm:inline">Try a payment</span>
            <span className="sm:hidden">Pay</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-line bg-white p-2 text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            <Icon name={open ? "x" : "queue"} />
            <span className="sr-only">Toggle navigation</span>
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-line bg-paper px-5 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-[13px] font-semibold",
                  isActive(item.href)
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink-soft",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
