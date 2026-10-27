"use client";

import { useState } from "react";
import { Callout, Icon, StatusPill } from "@/components/ui";
import { cn, formatPaise, relativeTime } from "@/lib/format";
import { useDemo } from "@/lib/store";
import type { ObserverChannel } from "@/lib/types";

export default function ObserversPage() {
  const { state, now, setObserverStatus, injectTestPayment } = useDemo();
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched" | "amount-mismatch">("all");

  const events = state.events.filter((event) => filter === "all" || event.verdict === filter);

  const setStatus = (channel: ObserverChannel, status: "online" | "degraded" | "offline") =>
    setObserverStatus(channel, status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Observer mesh</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">How a credit becomes a fact</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-mute">
            Bank alerts are normalised from three independent channels, signed, then matched on amount. Any channel
            alone can miss an alert; the mesh exists so one delivery failure does not block a paying customer.
          </p>
        </div>
        <button
          onClick={() => injectTestPayment(100, "success")}
          className="btn-dark !py-2 !text-[11.5px]"
        >
          <Icon name="bug" className="h-3.5 w-3.5" /> Inject observation
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {state.observers.map((observer) => (
          <div key={observer.channel} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-paper-deep text-ink-soft">
                  <Icon
                    name={observer.channel === "android" ? "phone" : observer.channel === "gmail" ? "receipt" : "chat"}
                    className="h-4 w-4"
                  />
                </span>
                <div>
                  <p className="text-[12px] font-semibold leading-tight text-ink">{observer.label}</p>
                  <p className="text-[10px] text-ink-mute">{observer.channel.toUpperCase()}</p>
                </div>
              </div>
              <StatusPill status={observer.status} />
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-ink-mute">{observer.detail}</p>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[10.5px]">
              <span className="text-ink-mute">{observer.metric}</span>
              <span className="font-mono text-ink">{relativeTime(observer.lastHeartbeat, now)}</span>
            </div>

            <div className="mt-2.5 flex gap-1">
              {(["online", "degraded", "offline"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatus(observer.channel, status)}
                  className={cn(
                    "flex-1 rounded-md border px-1.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.06em]",
                    observer.status === status
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink-mute hover:border-ink/25",
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <p className="text-[12px] font-semibold text-ink">Normalised observation stream</p>
            <div className="flex gap-1">
              {(["all", "matched", "unmatched", "amount-mismatch"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[9.5px] font-semibold",
                    filter === option
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink-mute hover:border-ink/25",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <ul className="divide-y divide-line">
            {events.map((event) => (
              <li key={event.id} className="px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
                    <Icon
                      name={event.channel === "android" ? "phone" : event.channel === "gmail" ? "receipt" : "chat"}
                      className="h-3 w-3"
                    />
                    {event.channel}
                    <span className="font-normal normal-case tracking-normal text-ink-mute">· {event.bank}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]",
                        event.verdict === "matched"
                          ? "bg-[#E7F4EE] text-ok"
                          : event.verdict === "amount-mismatch"
                            ? "bg-[#FBEBE9] text-bad"
                            : "bg-paper-deep text-ink-mute",
                      )}
                    >
                      {event.verdict}
                    </span>
                    <span className="mono-nums text-[11px] font-semibold text-ink">
                      {formatPaise(event.amountPaise)}
                    </span>
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[10.5px] text-ink-soft">{event.raw}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[9.5px] text-ink-mute">
                  <span>UTR {event.utr}</span>
                  <span>·</span>
                  <span>{relativeTime(event.receivedAt, now)}</span>
                  {event.matchedSessionId && (
                    <>
                      <span>·</span>
                      <span className="text-ok">linked to session</span>
                    </>
                  )}
                </p>
              </li>
            ))}
            {events.length === 0 && (
              <li className="px-4 py-6 text-[11.5px] text-ink-mute">No observations with this verdict yet.</li>
            )}
          </ul>
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <p className="label">Signature contract</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-mute">
              Observer payloads are signed with HMAC-SHA256 over the raw body using the device&apos;s enrolment
              secret. Replays are rejected by (device, message-hash) uniqueness.
            </p>
            <pre className="mt-2.5 overflow-x-auto rounded-lg border border-line bg-paper px-2.5 py-2 font-mono text-[10px] leading-relaxed text-ink-soft">
{`X-Observer-Signature: sha256=<64 hex>
X-Observer-Device: obs_android_4471
X-Observer-Received: 1761643122110`}
            </pre>
          </div>

          <div className="card p-4">
            <p className="label">Matching rules</p>
            <ul className="mt-2 space-y-2 text-[11px] leading-relaxed text-ink-soft">
              {[
                "Exact integer paise equality — never fuzzy, never rounding.",
                "UTR uniqueness prevents one credit being used twice.",
                "Only the buyer holding the active slot can be matched.",
                "Unmatched alerts stay in the stream for reconciliation.",
                "Amount mismatch fails the session instead of guessing.",
              ].map((rule) => (
                <li key={rule} className="flex gap-1.5">
                  <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-ok" />
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          <Callout tone="warn" title="Honest limitation">
            Alert parsing is best-effort: banks change formats, alerts arrive late and can be duplicated. The demo
            therefore keeps a human reconciliation path — staff can confirm or fail a payment manually, and that
            action is audited.
          </Callout>
        </div>
      </div>
    </div>
  );
}
