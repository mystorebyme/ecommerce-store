"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import type { SessionStatus } from "@/lib/types";

/* ------------------------------------------------------------------ icons */

const paths: Record<string, ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUpRight: <path d="M7 17 17 7M9 7h8v8" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />,
  queue: <path d="M4 6h16M4 12h16M4 18h10" />,
  signal: <path d="M3 20h3M9 20v-6m0 0h3M15 20V9m0 0h3M21 20V4" />,
  bank: <path d="M3 10 12 4l9 6M5 10v9m5-9v9m4-9v9m5-9v9M3 20h18" />,
  sparkle: <path d="m12 3 2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />,
  webhook: <path d="M9 20a4 4 0 0 1-3.4-6M15 4a4 4 0 0 1 3.4 6M6.6 14 12 4m5.4 6L12 20m-6 0h12" />,
  shield: <path d="M12 3 5 6v5c0 4.4 3 8.2 7 10 4-1.8 7-5.6 7-10V6z" />,
  gear: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.6l2-1.5-2-3.4-2.3 1a8 8 0 0 0-2.7-1.6L14.4 2h-4l-.4 2.5A8 8 0 0 0 7.3 6L5 5 3 8.4l2 1.5a8 8 0 0 0 0 3.2L3 14.6 5 18l2.3-1a8 8 0 0 0 2.7 1.6l.4 2.4h4l.4-2.4a8 8 0 0 0 2.7-1.6l2.3 1 2-3.4-2-1.5c.1-.5.2-1 .2-1.6Z" />,
  check: <path d="m4 12 5 5L20 6" />,
  copy: <path d="M9 9h10v12H9zM5 15V3h10" />,
  clock: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l4 2" />,
  lock: <path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z" />,
  phone: <path d="M7 3h4l2 5-3 2a12 12 0 0 0 4 4l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 5 5a2 2 0 0 1 2-2Z" />,
  chat: <path d="M4 20V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8z" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />,
  layers: <path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  warn: <path d="M12 4 2 20h20zM12 10v4M12 17h.01" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  refresh: <path d="M4 12a8 8 0 0 1 14-5l2 2M20 12a8 8 0 0 1-14 5l-2-2M18 4v5h-5M6 20v-5h5" />,
  book: <path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2zM20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2z" />,
  bug: <path d="M9 4l1.5 2h3L15 4M8 10h8M12 6a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0v-4a5 5 0 0 1 5-5ZM4 12h2m12 0h2M5 18l2-1m10 1-2-1" />,
  wallet: <path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4zM4 7V5a2 2 0 0 1 2-2h10M17 13h.01" />,
};

export function Icon({ name, className }: { name: keyof typeof paths | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
    >
      {paths[name] ?? paths.grid}
    </svg>
  );
}

/* ------------------------------------------------------------------- logo */

export function Logo({ label = "YouPI", compact = false }: { label?: string; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-brand text-[13px] font-bold text-white shadow-[inset_0_-2px_0_0_rgba(0,0,0,0.25)]">
        YP
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-paper bg-accent" aria-hidden />
      </span>
      {!compact && (
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink">{label}</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ misc */

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("label", className)}>{children}</p>;
}

export function StatusPill({ status }: { status: SessionStatus | "online" | "degraded" | "offline" }) {
  const map: Record<string, string> = {
    SUCCESS: "bg-[#E7F4EE] text-ok border-[#BBDFCE]",
    REFUNDED: "bg-[#EAF0F7] text-info border-[#C6D7E8]",
    ACTIVE: "bg-[#FDF3E0] text-warn border-[#F0DAB0]",
    PROCESSING: "bg-[#FDF3E0] text-warn border-[#F0DAB0]",
    QUEUED: "bg-paper-deep text-ink-soft border-line-strong",
    FAILED: "bg-[#FBEBE9] text-bad border-[#EFC6C1]",
    EXPIRED: "bg-paper-deep text-ink-mute border-line-strong",
    CANCELLED: "bg-paper-deep text-ink-mute border-line-strong",
    SUSPICIOUS: "bg-[#FBEBE9] text-bad border-[#EFC6C1]",
    online: "bg-[#E7F4EE] text-ok border-[#BBDFCE]",
    degraded: "bg-[#FDF3E0] text-warn border-[#F0DAB0]",
    offline: "bg-[#FBEBE9] text-bad border-[#EFC6C1]",
  };
  const dot: Record<string, string> = {
    SUCCESS: "bg-ok",
    REFUNDED: "bg-info",
    ACTIVE: "bg-warn",
    PROCESSING: "bg-warn",
    QUEUED: "bg-ink-mute",
    FAILED: "bg-bad",
    EXPIRED: "bg-ink-mute",
    CANCELLED: "bg-ink-mute",
    SUSPICIOUS: "bg-bad",
    online: "bg-ok",
    degraded: "bg-warn",
    offline: "bg-bad",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]",
        map[status] ?? map.QUEUED,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status] ?? "bg-ink-mute")} aria-hidden />
      {status}
    </span>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }, [value]);

  return (
    <button type="button" onClick={onCopy} className={cn("btn-ghost !px-2.5 !py-1.5 !text-[11px]", className)}>
      <Icon name={copied ? "check" : "copy"} className={cn("h-3.5 w-3.5", copied && "text-ok")} />
      {copied ? "Copied" : label}
    </button>
  );
}

export function CodeBlock({
  code,
  language = "bash",
  filename,
  className,
  maxHeight,
}: {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  maxHeight?: number;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-ink/80 bg-ink text-[12.5px] text-[#DCE7E3]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-[#3E4A54]" />
            <span className="h-2 w-2 rounded-full bg-[#3E4A54]" />
            <span className="h-2 w-2 rounded-full bg-[#3E4A54]" />
          </span>
          <span className="font-mono text-[11px] text-white/60">{filename ?? language}</span>
        </div>
        <CopyButton value={code} className="!border-white/15 !bg-white/5 !text-white/80 hover:!bg-white/10" />
      </div>
      <pre
        className="scroll-thin overflow-auto p-3.5 leading-relaxed"
        style={{ maxHeight: maxHeight ?? undefined }}
      >
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "warn";
}) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p
        className={cn(
          "mono-nums mt-1.5 text-[22px] font-semibold leading-none tracking-tight",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] leading-snug text-ink-mute">{hint}</p>}
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "ok" | "danger";
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    info: "border-[#C6D7E8] bg-[#EFF4F9]",
    warn: "border-[#F0DAB0] bg-[#FDF6E9]",
    ok: "border-[#BBDFCE] bg-[#EDF7F1]",
    danger: "border-[#EFC6C1] bg-[#FBEDEB]",
  } as const;
  const icons = { info: "book", warn: "warn", ok: "check", danger: "warn" } as const;
  return (
    <div className={cn("rounded-xl border px-3.5 py-3", tones[tone])}>
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink">
        <Icon name={icons[tone]} className="h-4 w-4 shrink-0" />
        {title}
      </p>
      {children && <div className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{children}</div>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" aria-label="Sections" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line pb-px">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative whitespace-nowrap rounded-t-lg px-3 py-2 text-[12.5px] font-semibold transition",
              active ? "text-brand" : "text-ink-mute hover:text-ink",
            )}
          >
            {tab.label}
            {tab.badge && (
              <span className="ml-1.5 rounded-full bg-paper-deep px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
                {tab.badge}
              </span>
            )}
            {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

export function MiniBars({ values, max }: { values: number[]; max?: number }) {
  const top = max ?? Math.max(...values, 1);
  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-full rounded-t-[3px]", i === values.length - 1 ? "bg-brand" : "bg-brand/25")}
          style={{ height: `${Math.max(6, (v / top) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-2 text-[26px] font-semibold leading-[1.15] text-ink sm:text-[32px]">{title}</h2>
      {copy && <p className="mt-3 text-[14px] leading-relaxed text-ink-mute">{copy}</p>}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-line bg-paper/70">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-9 sm:px-8 sm:py-12">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 max-w-3xl text-[30px] font-semibold leading-[1.1] text-ink sm:text-[42px]">{title}</h1>
        {copy && <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-mute sm:text-[15px]">{copy}</p>}
        {children && <div className="mt-5 flex flex-wrap items-center gap-2.5">{children}</div>}
      </div>
    </header>
  );
}

export function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-paper-deep text-ink-mute">
        <Icon name="layers" />
      </span>
      <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-mute">{copy}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: "right" | "bottom";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div
        className={cn(
          "relative z-10 flex flex-col bg-paper shadow-2xl",
          side === "right"
            ? "ml-auto h-full w-full max-w-[440px] animate-rise"
            : "mt-auto w-full animate-rise rounded-t-2xl",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">{title}</p>
          <button onClick={onClose} className="rounded-full border border-line bg-white p-1.5 text-ink-mute hover:text-ink">
            <Icon name="x" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function LinkCard({
  href,
  eyebrow,
  title,
  copy,
  cta,
}: {
  href: string;
  eyebrow?: string;
  title: string;
  copy: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group card flex flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-ledger"
    >
      {eyebrow && <p className="label">{eyebrow}</p>}
      <p className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{title}</p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{copy}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand">
        {cta}
        <Icon name="arrow" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
