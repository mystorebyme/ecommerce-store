"use client";

import Link from "next/link";
import { useState } from "react";
import { Callout, Icon, PageIntro, StatusPill } from "@/components/ui";
import { formatPaise, relativeTime } from "@/lib/format";
import { selectors, useDemo } from "@/lib/store";
import type { Session } from "@/lib/types";

type Mode = NonNullable<Session["simOutcome"]>;

export default function DemoPackPage() {
  const { state, now, createSession, checkPayment, adminRefund, clearQueue, resetDemo, injectTestPayment } = useDemo();
  const [message, setMessage] = useState<string | null>(null);
  const queue = selectors.queue(state);
  const stats = selectors.stats(state);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3200);
  };

  const run = (mode: Mode, amountPaise = 100) => {
    const id = createSession({
      amountPaise,
      note: `Demo pack · ${mode}`,
      source: "demo-pack",
      simOutcome: mode,
    });
    window.setTimeout(() => checkPayment(id), 900);
    flash(`Session created and sent into verification (${mode}). Open checkout to watch it resolve.`);
  };

  const fillQueue = () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      ids.push(
        createSession({
          amountPaise: 100,
          note: `Queue demo #${i + 1}`,
          source: "demo-pack",
          simOutcome: "success",
        }),
      );
    }
    window.setTimeout(() => checkPayment(ids[0]), 700);
    flash("Three buyers created: one holds the slot, two joined the FIFO queue.");
  };

  const latestSuccess = state.sessions.find((s) => s.status === "SUCCESS");

  return (
    <>
      <PageIntro
        eyebrow="Demo pack"
        title="One button per story — built for a live client call"
        copy="Pre-tuned scenarios so you never have to type during a screen share. Every action writes to the same sandbox ledger, so the admin console updates while you talk."
      >
        <Link href="/checkout" className="btn-primary !py-1.5 !text-[12px]">
          <Icon name="qr" className="h-3.5 w-3.5" /> Open checkout
        </Link>
        <Link href="/admin" className="btn-ghost !py-1.5 !text-[12px]">
          Open admin console
        </Link>
      </PageIntro>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-9 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            {[
              {
                title: "Happy path · ₹1",
                copy: "Creates a session, verifies it and lets the observer match the exact amount. Ends in SUCCESS with a signed webhook.",
                action: () => run("success"),
                cta: "Run happy path",
                icon: "check",
                tone: "border-[#BBDFCE] bg-[#EDF7F1]",
              },
              {
                title: "Amount mismatch",
                copy: "Observer reports ₹1.00 more than the session amount — the gateway refuses to auto-credit and marks it FAILED.",
                action: () => run("mismatch"),
                cta: "Run mismatch",
                icon: "warn",
                tone: "border-[#EFC6C1] bg-[#FBEDEB]",
              },
              {
                title: "Fraud flag",
                copy: "Simulates a blocked device fingerprint. Session is held as SUSPICIOUS and the fingerprint is banned.",
                action: () => run("suspicious"),
                cta: "Run fraud flag",
                icon: "shield",
                tone: "border-[#F0DAB0] bg-[#FDF6E9]",
              },
              {
                title: "Queue pressure",
                copy: "Creates three buyers at once: one holds the only active slot, two wait. Release the slot and watch the promotion.",
                action: fillQueue,
                cta: "Fill the queue",
                icon: "queue",
                tone: "border-line bg-white",
              },
              {
                title: "No observation",
                copy: "Buyer claims to have paid but no bank alert arrives. After the 30s window the session fails — safely.",
                action: () => run("timeout", 4900),
                cta: "Run timeout",
                icon: "clock",
                tone: "border-line bg-white",
              },
            ].map((card) => (
              <div key={card.title} className={`rounded-xl border p-4 ${card.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                      <Icon name={card.icon} className="h-4 w-4" />
                      {card.title}
                    </p>
                    <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-ink-soft">{card.copy}</p>
                  </div>
                  <button onClick={card.action} className="btn-dark shrink-0 !px-3 !py-1.5 !text-[11.5px]">
                    {card.cta}
                  </button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  injectTestPayment(4900, "success");
                  flash("Injected a test-mode payment of ₹49.00 — watch the observer panel.");
                }}
                className="btn-ghost !text-[11.5px]"
              >
                <Icon name="bug" className="h-3.5 w-3.5" /> Inject test payment
              </button>
              <button
                onClick={() => {
                  if (latestSuccess) {
                    adminRefund(latestSuccess.id);
                    flash(`Refund raised on ${latestSuccess.orderId}. A REFUNDED webhook was queued.`);
                  } else {
                    flash("No successful payment to refund yet.");
                  }
                }}
                className="btn-ghost !text-[11.5px]"
              >
                <Icon name="receipt" className="h-3.5 w-3.5" /> Refund latest success
              </button>
              <button
                onClick={() => {
                  clearQueue();
                  flash("Queued sessions cancelled and logged.");
                }}
                className="btn-ghost !text-[11.5px]"
              >
                <Icon name="queue" className="h-3.5 w-3.5" /> Clear the queue
              </button>
              <button
                onClick={() => {
                  resetDemo();
                  flash("Demo data reset to the seeded state.");
                }}
                className="btn-ghost !text-[11.5px]"
              >
                <Icon name="refresh" className="h-3.5 w-3.5" /> Reset everything
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="label">Live board</p>
                <span className="font-mono text-[10px] text-ink-mute">auto-refresh 1s</span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                {[
                  { k: "Ledger", v: String(stats.total) },
                  { k: "Volume", v: formatPaise(stats.volume) },
                  { k: "Queue", v: String(queue.length) },
                ].map((item) => (
                  <div key={item.k} className="rounded-lg border border-line bg-paper px-2.5 py-2">
                    <p className="text-[9.5px] uppercase tracking-[0.1em] text-ink-mute">{item.k}</p>
                    <p className="mono-nums mt-0.5 text-[12.5px] font-semibold text-ink">{item.v}</p>
                  </div>
                ))}
              </div>

              <ul className="mt-3 space-y-1.5">
                {state.sessions.slice(0, 6).map((session) => (
                  <li
                    key={session.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5"
                  >
                    <span className="flex items-center gap-2">
                      <StatusPill status={session.status} />
                      <span className="font-mono text-[10.5px] text-ink-mute">{session.orderId}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="mono-nums text-[11px] font-semibold text-ink">
                        {formatPaise(session.amountPaise)}
                      </span>
                      <span className="hidden text-[10px] text-ink-mute sm:inline">
                        {relativeTime(session.createdAt, now)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="card p-4">
              <p className="label">5-minute call script</p>
              <ol className="mt-2 space-y-2 text-[11.5px] leading-relaxed text-ink-soft">
                {[
                  "Open the store, add a kurta to the cart and hit Pay — the total is passed as paise.",
                  "Verify the WhatsApp OTP, then create the QR. Point at the 5:00 timer.",
                  "Open a second tab and press 'Fill the queue' to show single-slot FIFO.",
                  "Press 'I have paid' and let the observer match the amount.",
                  "Jump to Admin → Webhooks and verify the HMAC signature live.",
                  "Finish on Docs → checklist so the client knows what go-live needs.",
                ].map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="mono-nums mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ink text-[9px] font-bold text-white">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <Callout tone="info" title="State lives in this browser">
              Sessions are persisted in localStorage so a refresh does not wipe your demo. Use “Reset everything”
              before handing the laptop over.
            </Callout>
          </aside>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-5 left-1/2 z-40 w-[min(92vw,440px)] -translate-x-1/2 animate-rise rounded-xl border border-ink bg-ink px-4 py-2.5 text-[12px] font-medium text-white shadow-ledger">
          {message}
        </div>
      )}
    </>
  );
}
