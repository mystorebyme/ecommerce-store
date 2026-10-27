"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn, formatPaise, relativeTime } from "@/lib/format";
import { useDemo } from "@/lib/store";
import { Icon, StatusPill } from "./ui";

export function HeroDemoCard() {
  const router = useRouter();
  const { state, now, createSession, checkPayment } = useDemo();
  const amounts = [100, 1000, 4900, 14900];
  const [amount, setAmount] = useState(100);
  const [busy, setBusy] = useState(false);

  const latest = state.sessions[0];
  const latestEvent = state.events[0];
  const active = state.sessions.find((s) => s.status === "ACTIVE" || s.status === "PROCESSING");

  const run = () => {
    setBusy(true);
    const id = createSession({
      amountPaise: amount,
      note: `Home page demo ${formatPaise(amount)}`,
      source: "demo-pack",
      simOutcome: "success",
    });
    router.push(`/checkout?session=${id}`);
  };

  return (
    <div className="relative">
      <div className="absolute -right-2 -top-2 z-10 rotate-2 rounded-full border border-ink bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ink shadow-pop">
        Live sandbox
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-line bg-paper px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-[11px] font-bold text-white">
              YP
            </span>
            <div>
              <p className="text-[12px] font-semibold leading-none text-ink">Demo checkout</p>
              <p className="mt-0.5 text-[10.5px] leading-none text-ink-mute">YouPI sandbox merchant</p>
            </div>
          </div>
          <span className="chip !text-[10px]">
            <Icon name="clock" className="h-3 w-3" /> 5:00 + 0:30
          </span>
        </div>

        <div className="p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="label">Amount</p>
              <p className="mono-nums mt-1 text-[34px] font-semibold leading-none tracking-tight text-ink">
                {formatPaise(amount)}
              </p>
            </div>
            <span className="chip border-[#BBDFCE] bg-[#EDF7F1] text-ok">
              <Icon name="check" className="h-3 w-3" /> amount fixed by server
            </span>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-1.5">
            {amounts.map((paise) => (
              <button
                key={paise}
                type="button"
                onClick={() => setAmount(paise)}
                aria-pressed={amount === paise}
                className={cn(
                  "rounded-xl border px-2 py-2 text-[12px] font-semibold transition",
                  amount === paise
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-white text-ink-soft hover:border-ink/25",
                )}
              >
                {formatPaise(paise).replace(".00", "")}
              </button>
            ))}
          </div>

          <button onClick={run} disabled={busy} className="btn-primary mt-3 w-full">
            <Icon name="qr" className="h-4 w-4" />
            {busy ? "Opening checkout…" : `Run a live ${formatPaise(amount)} checkout`}
          </button>

          <p className="mt-2 text-center text-[10.5px] leading-relaxed text-ink-mute">
            WhatsApp OTP → dynamic QR → observer verification → signed webhook. Nothing leaves this browser.
          </p>

          <div className="mt-4 rounded-xl border border-line bg-paper px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="label">Latest verified payment</p>
              {latest ? <StatusPill status={latest.status} /> : null}
            </div>
            {latest ? (
              <>
                <p className="mt-1.5 flex items-baseline gap-2">
                  <span className="mono-nums text-[15px] font-semibold text-ink">
                    {formatPaise(latest.amountPaise)}
                  </span>
                  <span className="font-mono text-[10.5px] text-ink-mute">{latest.orderId}</span>
                  <span className="ml-auto text-[10.5px] text-ink-mute">{relativeTime(latest.createdAt, now)}</span>
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10.5px] text-ink-mute">
                  <Icon name="signal" className="h-3 w-3 text-ok" />
                  {latestEvent ? (
                    <span className="truncate">
                      {latestEvent.bank} · {latestEvent.channel} observer · UTR{" "}
                      <span className="font-mono">{latestEvent.utr}</span>
                    </span>
                  ) : (
                    <span>Waiting for the first bank observation</span>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-[12px] text-ink-mute">Run a checkout to populate the ledger.</p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => (active ? checkPayment(active.id) : router.push("/store"))}
              className="btn-ghost !justify-start !text-[11.5px]"
            >
              <Icon name="signal" className="h-3.5 w-3.5 text-brand" />
              {active ? "Verify active slot" : "Open merchant store"}
            </button>
            <button onClick={() => router.push("/admin")} className="btn-ghost !justify-start !text-[11.5px]">
              <Icon name="grid" className="h-3.5 w-3.5 text-brand" />
              Admin console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
