"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminTabs } from "@/lib/config";
import { cn } from "@/lib/format";
import { useDemo } from "@/lib/store";
import { Icon, Logo } from "@/components/ui";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state } = useDemo();
  const current = pathname.replace("/admin", "").replace("/", "") || "dashboard";

  return (
    <div className="border-t border-line bg-[#F3F0E9]">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-0 px-0 sm:px-8 sm:py-6 lg:flex-row lg:gap-6">
        {/* sidebar */}
        <aside className="lg:w-[228px] lg:shrink-0">
          <div className="border-b border-line bg-white px-4 py-3 sm:rounded-2xl sm:border">
            <div className="flex items-center justify-between">
              <Logo label="Merchant admin" />
              <span className="rounded-full border border-[#F0DAB0] bg-[#FDF6E9] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.1em] text-warn">
                {state.settings.testMode ? "test mode" : "live"}
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
              Signed in as <span className="font-semibold text-ink">owner@merchant</span> · role{" "}
              <span className="font-mono text-ink-soft">owner</span>
            </p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="chip !px-2 !py-0.5 !text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" /> API healthy
              </span>
              <span className="chip !px-2 !py-0.5 !text-[10px]">VPA {state.activeVpa.split("@")[0]}</span>
            </div>
          </div>

          <nav
            aria-label="Admin sections"
            className="scroll-thin flex gap-1 overflow-x-auto border-b border-line bg-white px-3 py-2 sm:mt-3 sm:flex-col sm:rounded-2xl sm:border sm:overflow-visible sm:px-2 sm:py-2"
          >
            {adminTabs.map((tab) => {
              const href = tab.slug === "dashboard" ? "/admin" : `/admin/${tab.slug}`;
              const active = current === tab.slug || (tab.slug === "dashboard" && current === "");
              return (
                <Link
                  key={tab.slug}
                  href={href}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] font-semibold transition",
                    active ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-deep",
                  )}
                >
                  <Icon name={tab.icon} className={cn("h-3.5 w-3.5", active ? "text-accent" : "text-ink-mute")} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden sm:mt-3 sm:block sm:rounded-2xl sm:border sm:border-line sm:bg-white sm:p-3">
            <p className="label">Demo tip</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-mute">
              Every action here writes an audit entry. Open{" "}
              <Link href="/admin/settings" className="link-underline">
                Settings
              </Link>{" "}
              to see the trail.
            </p>
          </div>
        </aside>

        {/* content */}
        <div className="min-w-0 flex-1 px-4 py-5 sm:px-0 sm:py-0">{children}</div>
      </div>
    </div>
  );
}
