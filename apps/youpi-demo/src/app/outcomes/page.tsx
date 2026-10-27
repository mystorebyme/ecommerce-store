"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CodeBlock, Icon, PageIntro, Tabs, StatusPill } from "@/components/ui";
import { cn, formatPaise } from "@/lib/format";
import { useDemo } from "@/lib/store";

type OutcomeKey = "success" | "failed" | "suspicious" | "expired" | "cancelled";

const definitions: Record<
  OutcomeKey,
  {
    status: string;
    title: string;
    body: string;
    tone: string;
    icon: string;
    primary: { label: string; href: string };
    secondary: { label: string; href: string };
    facts: { k: string; v: string }[];
    merchantAction: string;
  }
> = {
  success: {
    status: "SUCCESS",
    title: "Payment verified",
    body: "The bank observation matched this session's amount and reference exactly. The order is marked paid on the server and a signed webhook has been queued.",
    tone: "ok",
    icon: "check",
    primary: { label: "Open the order in admin", href: "/admin/payments" },
    secondary: { label: "Back to store", href: "/store" },
    facts: [
      { k: "Amount", v: "matches exactly" },
      { k: "UTR", v: "recorded" },
      { k: "Webhook", v: "delivered, signed" },
    ],
    merchantAction:
      "Fulfil the order only after your server has verified X-Gateway-Signature on the raw body, then deduplicate on the delivery id.",
  },
  failed: {
    status: "FAILED",
    title: "Verification timed out",
    body: "No matching credit alert arrived inside the 30-second verification window. Nothing was deducted on the gateway side, so the buyer can retry safely.",
    tone: "bad",
    icon: "warn",
    primary: { label: "Retry the checkout", href: "/checkout" },
    secondary: { label: "Talk to support", href: "/admin/observers" },
    facts: [
      { k: "Money", v: "not captured" },
      { k: "Slot", v: "released" },
      { k: "Retry", v: "allowed" },
    ],
    merchantAction:
      "Never mark an order paid from a browser redirect. If the buyer insists they paid, reconcile the UTR against the bank statement before confirming manually.",
  },
  suspicious: {
    status: "SUSPICIOUS",
    title: "Held for review",
    body: "Fraud heuristics flagged this attempt — repeated abandoned sessions and a device fingerprint that is already on the ban list. The session is held, not failed.",
    tone: "warn",
    icon: "shield",
    primary: { label: "Review in security tab", href: "/admin/security" },
    secondary: { label: "Observer log", href: "/admin/observers" },
    facts: [
      { k: "Fingerprint", v: "banned" },
      { k: "Slot", v: "not allocated" },
      { k: "Staff", v: "notified" },
    ],
    merchantAction:
      "Hold fulfilment and investigate. If the payment is genuine, confirm it manually from the admin console — that action writes an audit entry.",
  },
  expired: {
    status: "EXPIRED",
    title: "Session expired",
    body: "The 5-minute payment window elapsed before the QR was scanned. The slot is released immediately and the first waiting buyer is promoted.",
    tone: "neutral",
    icon: "clock",
    primary: { label: "Create a new QR", href: "/checkout" },
    secondary: { label: "See the live queue", href: "/admin/queue" },
    facts: [
      { k: "Slot", v: "released" },
      { k: "Queue", v: "promoted" },
      { k: "Timers", v: "server-side" },
    ],
    merchantAction:
      "Timers live in the database, so a refresh, a closed tab or a server restart never keeps a stale slot alive.",
  },
  cancelled: {
    status: "CANCELLED",
    title: "Checkout closed",
    body: "The buyer closed the checkout before paying. Cancellation is a first-class state, not an error — it frees the UPI slot and updates the queue instantly.",
    tone: "neutral",
    icon: "x",
    primary: { label: "Try again", href: "/checkout" },
    secondary: { label: "Back to store", href: "/store" },
    facts: [
      { k: "Order", v: "kept, not paid" },
      { k: "Slot", v: "released" },
      { k: "Audit", v: "entry written" },
    ],
    merchantAction:
      "Abandoned checkouts feed the recovery queue. The demo keeps the order record so nothing silently disappears.",
  },
};

const tabs: { id: OutcomeKey; label: string }[] = [
  { id: "success", label: "Success" },
  { id: "failed", label: "Failed" },
  { id: "suspicious", label: "Suspicious" },
  { id: "expired", label: "Expired" },
  { id: "cancelled", label: "Cancelled" },
];

function samplePayload(status: string, amountPaise: number, orderId: string): string {
  return JSON.stringify(
    {
      event: status === "SUCCESS" ? "SUCCESS" : status,
      paymentId: "pay_8f21c7a4d3e1",
      orderId,
      amount: (amountPaise / 100).toFixed(2),
      amountPaise,
      currency: "INR",
      utr: "412345678901",
      deliveryId: "dlv_2c9f81a4b7",
      timestamp: Date.now(),
    },
    null,
    2,
  );
}

export default function OutcomesPage() {
  const { state, now } = useDemo();
  const [active, setActive] = useState<OutcomeKey>("success");

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("state");
    if (param && (tabs.map((t) => t.id) as string[]).includes(param)) {
      setActive(param as OutcomeKey);
    }
  }, []);

  const def = definitions[active];
  const sample =
    state.sessions.find((s) => s.status === def.status) ??
    state.sessions.find((s) => s.status === "SUCCESS") ??
    state.sessions[0];

  const toneClasses: Record<string, string> = {
    ok: "border-[#BBDFCE] bg-[#EDF7F1] text-ok",
    bad: "border-[#EFC6C1] bg-[#FBEDEB] text-bad",
    warn: "border-[#F0DAB0] bg-[#FDF6E9] text-warn",
    neutral: "border-line bg-paper-deep text-ink-soft",
  };

  return (
    <>
      <PageIntro
        eyebrow="Surface 03 · Outcome pages"
        title="Five honest endings, each with the right next step"
        copy="A payment gateway is judged in the unhappy paths. These are the five standard outcomes the demo can produce — switch tabs to see the buyer view and what the merchant is told."
      >
        <span className="chip">
          <Icon name="layers" className="h-3.5 w-3.5" /> buyer view + merchant action
        </span>
        <span className="chip">
          <Icon name="shield" className="h-3.5 w-3.5" /> nothing auto-fulfils
        </span>
      </PageIntro>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-9 sm:px-8">
        <Tabs tabs={tabs} value={active} onChange={setActive} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          {/* buyer-facing outcome screen */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-[10px] font-bold text-white">
                  YP
                </span>
                <span className="text-[11.5px] font-semibold text-ink">{state.settings.merchantName}</span>
              </div>
              <span className="font-mono text-[10px] text-ink-mute">/order-{active}</span>
            </div>

            <div className="p-6 text-center">
              <div
                className={cn(
                  "mx-auto grid h-16 w-16 place-items-center rounded-full border-2",
                  toneClasses[def.tone],
                )}
              >
                <Icon name={def.icon} className="h-7 w-7" />
              </div>
              <p className="mt-4 text-[22px] font-semibold leading-tight text-ink">{def.title}</p>
              <div className="mt-2 flex justify-center">
                <StatusPill status={def.status as never} />
              </div>
              <p className="mx-auto mt-3 max-w-sm text-[12.5px] leading-relaxed text-ink-mute">{def.body}</p>

              {sample && (
                <div className="mx-auto mt-5 max-w-sm rounded-xl border border-line bg-paper px-4 py-3 text-left">
                  <div className="flex items-center justify-between text-[11px] text-ink-mute">
                    <span>Order</span>
                    <span className="font-mono text-ink">{sample.orderId}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-ink-mute">Amount</span>
                    <span className="mono-nums text-[15px] font-semibold text-ink">
                      {formatPaise(sample.amountPaise)}
                    </span>
                  </div>
                  {sample.utr && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-ink-mute">UTR</span>
                      <span className="font-mono text-ink-soft">{sample.utr}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-ink-mute">Updated</span>
                    <span className="text-ink-soft">{new Date(now).toLocaleTimeString("en-IN")}</span>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Link href={def.primary.href} className="btn-primary">
                  {def.primary.label}
                  <Icon name="arrow" className="h-4 w-4" />
                </Link>
                <Link href={def.secondary.href} className="btn-ghost">
                  {def.secondary.label}
                </Link>
              </div>
            </div>

            <div className="border-t border-line bg-paper/70 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[10.5px] text-ink-mute">
                <Icon name="lock" className="h-3 w-3" />
                {state.branding.footerGuarantee} · support {state.branding.supportEmail}
              </p>
            </div>
          </div>

          {/* merchant-facing side */}
          <div className="space-y-4">
            <div className="card p-5">
              <p className="label">What the merchant is told</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{def.merchantAction}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {def.facts.map((fact) => (
                  <div key={fact.k} className="rounded-xl border border-line bg-paper px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-ink-mute">{fact.k}</p>
                    <p className="mt-0.5 text-[11.5px] font-semibold text-ink">{fact.v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <p className="label">Status vocabulary</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {["ACTIVE", "QUEUED", "PROCESSING", "SUCCESS", "FAILED", "EXPIRED", "CANCELLED", "SUSPICIOUS", "REFUNDED"].map(
                  (status) => (
                    <StatusPill key={status} status={status as never} />
                  ),
                )}
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-mute">
                The webhook only ever carries a terminal state. Intermediate states stay inside the gateway and
                its polling API, so your order table never has to model them.
              </p>
            </div>

            <CodeBlock
              filename="terminal webhook payload"
              language="json"
              code={samplePayload(def.status, sample?.amountPaise ?? 4900, sample?.orderId ?? "YP-1041")}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                "rounded-xl border px-3.5 py-3 text-left transition",
                active === tab.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/25",
              )}
            >
              <p className={cn("text-[12px] font-semibold", active === tab.id ? "text-white" : "text-ink")}>
                /order-{tab.id}
              </p>
              <p className={cn("mt-0.5 text-[10.5px]", active === tab.id ? "text-white/60" : "text-ink-mute")}>
                {definitions[tab.id].title}
              </p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
