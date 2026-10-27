"use client";

import { useMemo, useState } from "react";
import { Callout, CodeBlock, CopyButton, EmptyState, Icon, StatusPill } from "@/components/ui";
import { gatewaySignature, signaturesMatch } from "@/lib/hmac";
import { cn, dateTime, formatPaise, maskSecret } from "@/lib/format";
import { headerBlock } from "@/lib/webhook";
import { useDemo } from "@/lib/store";

export default function WebhooksPage() {
  const { state, rotateSecret } = useDemo();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tampered, setTampered] = useState(false);
  const [revealSecret, setRevealSecret] = useState(false);

  const delivery =
    state.deliveries.find((d) => d.id === selectedId) ?? state.deliveries[0] ?? null;

  const verification = useMemo(() => {
    if (!delivery) return null;
    const body = tampered
      ? delivery.payload.replace(/"amountPaise":(\d+)/, (_, p1) => `"amountPaise":${Number(p1) + 100}`)
      : delivery.payload;
    const expected = gatewaySignature(state.settings.webhookSecret, body);
    const ok = signaturesMatch(expected, delivery.signature);
    return { body, expected, ok };
  }, [delivery, tampered, state.settings.webhookSecret]);

  const verifySnippet = `import crypto from "node:crypto";

const expected =
  "sha256=" +
  crypto
    .createHmac("sha256", process.env.YOUPI_WEBHOOK_SECRET)
    .update(rawBody)              // Buffer, before JSON.parse
    .digest("hex");

const received = req.headers["x-gateway-signature"] ?? "";
const ok =
  received.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));

if (!ok) return res.status(401).end();
return res.status(200).json({ ok: true });`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Webhooks</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">Signed, retried, replay-safe</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-mute">
            The only authoritative proof that money arrived. Verify the HMAC over the raw bytes, then dedupe on the
            delivery id before touching an order.
          </p>
        </div>
        <button
          onClick={() => {
            const next = rotateSecret("webhook");
            setRevealSecret(true);
            void next;
          }}
          className="btn-ghost !py-2 !text-[11.5px]"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" /> Rotate signing secret
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Endpoint", v: state.settings.webhookUrl.replace("https://", ""), mono: true },
          { k: "Secret", v: revealSecret ? state.settings.webhookSecret : maskSecret(state.settings.webhookSecret), mono: true },
          { k: "Delivered", v: `${state.deliveries.filter((d) => d.status === "delivered").length} / ${state.deliveries.length}` },
          { k: "Algorithm", v: "HMAC-SHA256" },
        ].map((item) => (
          <div key={item.k} className="card p-3.5">
            <p className="label">{item.k}</p>
            <p className={cn("mt-1 truncate text-[12px] font-semibold text-ink", item.mono && "font-mono !text-[11px]")}>
              {item.v}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-[12px] font-semibold text-ink">Delivery log</p>
            <span className="font-mono text-[10px] text-ink-mute">{state.deliveries.length} events</span>
          </div>
          {state.deliveries.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing delivered yet"
                copy="Finish a checkout or confirm a payment from the ledger to generate a signed delivery."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {state.deliveries.slice(0, 12).map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition",
                      delivery?.id === item.id ? "bg-paper" : "hover:bg-paper/70",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase",
                            item.event === "SUCCESS"
                              ? "bg-[#E7F4EE] text-ok"
                              : item.event === "REFUNDED"
                                ? "bg-[#EAF0F7] text-info"
                                : "bg-[#FBEBE9] text-bad",
                          )}
                        >
                          {item.event}
                        </span>
                        <span className="font-mono text-[11px] text-ink">{item.orderId}</span>
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[9.5px] text-ink-mute">
                        {item.deliveryId} · {dateTime(item.timestamp)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="mono-nums text-[11px] font-semibold text-ink">
                        {formatPaise(item.amountPaise)}
                      </span>
                      <StatusPill status={item.status === "delivered" ? "SUCCESS" : "ACTIVE"} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          {delivery && verification ? (
            <>
              <div className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="label">Verify a delivery, live</p>
                  <label className="flex items-center gap-2 text-[11px] text-ink-soft">
                    <input
                      type="checkbox"
                      className="accent-[#B3322A]"
                      checked={tampered}
                      onChange={(event) => setTampered(event.target.checked)}
                    />
                    Tamper with the body
                  </label>
                </div>

                <div
                  className={cn(
                    "mt-2.5 rounded-xl border px-3 py-2.5",
                    verification.ok
                      ? "border-[#BBDFCE] bg-[#EDF7F1]"
                      : "border-[#EFC6C1] bg-[#FBEDEB]",
                  )}
                >
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-[11.5px] font-semibold",
                      verification.ok ? "text-ok" : "text-bad",
                    )}
                  >
                    <Icon name={verification.ok ? "check" : "warn"} className="h-3.5 w-3.5" />
                    {verification.ok
                      ? "Signature valid — safe to fulfil this order"
                      : "Signature does not match — reject with 401"}
                  </p>
                  <p className="mt-1 break-all font-mono text-[9.5px] leading-relaxed text-ink-mute">
                    expected {verification.expected.slice(0, 28)}…
                    <br />
                    received {delivery.signature.slice(0, 28)}…
                  </p>
                </div>

                <div className="mt-2.5 max-h-[260px] overflow-auto rounded-lg border border-ink/80 bg-ink p-3">
                  <pre className="font-mono text-[10.5px] leading-relaxed text-[#DCE7E3]">
                    {headerBlock({ ...delivery, payload: verification.body })}
                  </pre>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <CopyButton value={headerBlock(delivery)} label="Copy request" />
                  <CopyButton value={delivery.signature} label="Copy signature" />
                  <CopyButton value={delivery.payload} label="Copy body" />
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title="Pick a delivery"
              copy="Select an event on the left to inspect headers, body and signature verification."
            />
          )}

          <CodeBlock filename="verify-webhook.ts" language="typescript" code={verifySnippet} maxHeight={230} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Callout tone="danger" title="Never trust the browser callback">
          A redirect, a closed tab or a `handler()` callback is UI sugar. Fulfilment must wait for a verified
          server-to-server delivery, or a server-side status lookup.
        </Callout>
        <Callout tone="info" title="Retries are byte-identical">
          Failed deliveries retry with backoff. The body, timestamp and delivery id stay the same, so dedupe on the
          delivery id — not on the timestamp.
        </Callout>
      </div>
    </div>
  );
}
