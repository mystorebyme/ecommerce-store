"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckoutPanel } from "@/components/CheckoutSession";
import { Callout, Icon, PageIntro, StatusPill } from "@/components/ui";
import { cn, clockTime, formatPaise, maskPhone, mmss, relativeTime, rupeesToPaise } from "@/lib/format";
import { selectors, useDemo } from "@/lib/store";
import type { Session } from "@/lib/types";

type Outcome = NonNullable<Session["simOutcome"]>;

const outcomes: { id: Outcome; label: string; hint: string }[] = [
  { id: "success", label: "Paid · observer matches", hint: "Amount + UTR match, session turns SUCCESS in ~4s" },
  { id: "mismatch", label: "Amount mismatch", hint: "Observer sees a different amount → FAILED, no auto-credit" },
  { id: "timeout", label: "No observation", hint: "Nothing arrives in the 30s verify window → FAILED" },
  { id: "suspicious", label: "Fraud flagged", hint: "Held for review, device fingerprint banned" },
];

export default function CheckoutPage() {
  const { state, now, createSession, sendOtp, verifyOtp, resetOtp } = useDemo();
  const [sessionParam, setSessionParam] = useState<string | null>(null);
  const [fromStore, setFromStore] = useState(false);
  const [phone, setPhone] = useState("9876543210");
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [amount, setAmount] = useState(4900);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState<Session["method"]>("UPI");
  const [outcome, setOutcome] = useState<Outcome>("success");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionParam(params.get("session"));
    setFromStore(params.get("from") === "store");
  }, []);

  const session = selectors.session(state, sessionParam);
  const verified = Boolean(state.customer?.verifiedAt);
  const otp = state.otp;
  const payAmount = custom ? rupeesToPaise(custom) : amount;

  const activeSlot = useMemo(
    () => state.sessions.find((s) => s.status === "ACTIVE" || s.status === "PROCESSING"),
    [state.sessions],
  );
  const queue = selectors.queue(state);

  const create = () => {
    if (payAmount <= 0) return;
    const id = createSession({
      amountPaise: payAmount,
      method,
      note: "Checkout page demo",
      source: "demo-pack",
      simOutcome: outcome,
    });
    setSessionParam(id);
    window.history.replaceState({}, "", `/checkout?session=${id}`);
  };

  return (
    <>
      <PageIntro
        eyebrow="Surface 02 · Checkout"
        title="WhatsApp OTP → single-use QR → observer verification"
        copy="This is the merchant-hosted checkout surface. Verify the buyer, lock the amount on the server, then watch the verification window tick down."
      >
        <span className="chip">
          <Icon name="lock" className="h-3.5 w-3.5" /> Amount set server-side
        </span>
        <span className="chip">
          <Icon name="clock" className="h-3.5 w-3.5" /> 5:00 pay · 0:30 verify
        </span>
        <button
          onClick={() => {
            setSessionParam(null);
            window.history.replaceState({}, "", "/checkout");
          }}
          className="btn-ghost !py-1.5 !text-[12px]"
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          New session
        </button>
      </PageIntro>

      <div className="mx-auto grid w-full max-w-[1180px] gap-6 px-5 py-9 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        {/* -------------------------------------------------- left column */}
        <div className="space-y-4">
          {session ? (
            <>
              {fromStore && (
                <Callout tone="ok" title="Order created from the demo store">
                  Cart total <span className="font-mono">{formatPaise(session.amountPaise)}</span> was passed to the
                  gateway as an integer and re-validated on the server before this QR was drawn.
                </Callout>
              )}
              <CheckoutPanel session={session} />
            </>
          ) : !verified ? (
            <div className="card overflow-hidden">
              <div className="border-b border-line bg-paper px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-[12.5px] font-semibold text-ink">Step 1 · Verify the buyer</p>
                  <span className="chip !text-[10px]">
                    <Icon name="chat" className="h-3 w-3" /> WhatsApp OTP
                  </span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-[13px] leading-relaxed text-ink-mute">
                  No payment slot is allocated until the phone number is verified. In production this code lands in
                  WhatsApp via the gateway&apos;s own socket session; in this sandbox it is shown below.
                </p>

                <label htmlFor="phone" className="label mt-5 block">
                  Mobile number
                </label>
                <div className="mt-1.5 flex gap-2">
                  <span className="grid place-items-center rounded-xl border border-line bg-paper px-3 text-[13px] text-ink-mute">
                    +91
                  </span>
                  <input
                    id="phone"
                    className="field"
                    inputMode="numeric"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9876543210"
                  />
                  <button
                    onClick={() => {
                      if (phone.length !== 10) {
                        setOtpError("Enter a 10-digit mobile number.");
                        return;
                      }
                      setOtpError(null);
                      setOtpInput("");
                      sendOtp(phone);
                    }}
                    className="btn-primary shrink-0"
                  >
                    Send OTP
                  </button>
                </div>

                {otp && (
                  <div className="mt-4 rounded-xl border border-[#F0DAB0] bg-[#FDF6E9] p-3.5">
                    <p className="flex items-center justify-between text-[11px] font-semibold text-warn">
                      Sandbox delivery · WhatsApp
                      <span className="font-mono font-normal text-ink-mute">{clockTime(otp.sentAt)}</span>
                    </p>
                    <p className="mt-1 text-[12px] text-ink-soft">
                      Your YouPI verification code for {maskPhone(otp.phone)} is
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="mono-nums rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-[20px] font-bold tracking-[0.3em] text-ink">
                        {otp.code}
                      </span>
                      <button
                        onClick={() => setOtpInput(otp.code)}
                        className="btn-ghost !px-2.5 !py-1.5 !text-[11px]"
                      >
                        Auto-fill
                      </button>
                    </div>
                  </div>
                )}

                <label htmlFor="otp" className="label mt-4 block">
                  6-digit code
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="otp"
                    className="field font-mono tracking-[0.35em]"
                    inputMode="numeric"
                    placeholder="······"
                    value={otpInput}
                    onChange={(event) => setOtpInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <button
                    onClick={() => {
                      if (!otp) {
                        setOtpError("Send an OTP first.");
                        return;
                      }
                      const ok = verifyOtp(otpInput);
                      if (!ok) {
                        setOtpError("That code does not match. Try the code shown above.");
                        return;
                      }
                      setOtpError(null);
                    }}
                    className="btn-dark shrink-0"
                  >
                    Verify
                  </button>
                </div>

                {otpError && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-bad">
                    <Icon name="warn" className="h-3.5 w-3.5" /> {otpError}
                  </p>
                )}

                <div className="mt-5 grid gap-2 border-t border-line pt-4 text-[11.5px] text-ink-mute sm:grid-cols-2">
                  <span className="flex items-center gap-1.5">
                    <Icon name="shield" className="h-3.5 w-3.5 text-ok" /> Verified numbers are remembered for 30
                    days
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon name="warn" className="h-3.5 w-3.5 text-warn" /> Fake numbers stop at this step
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-paper px-4 py-3">
                <p className="text-[12.5px] font-semibold text-ink">Step 2 · Create the payment session</p>
                <span className="chip border-[#BBDFCE] bg-[#EDF7F1] !text-[10px] text-ok">
                  <Icon name="check" className="h-3 w-3" /> {maskPhone(state.customer?.phone ?? "")} verified
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <p className="label">Amount</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[100, 1000, 4900, 14900, 189900].map((paise) => (
                      <button
                        key={paise}
                        onClick={() => {
                          setAmount(paise);
                          setCustom("");
                        }}
                        aria-pressed={!custom && amount === paise}
                        className={cn(
                          "rounded-xl border px-3 py-1.5 text-[12px] font-semibold",
                          !custom && amount === paise
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-white text-ink-soft hover:border-ink/25",
                        )}
                      >
                        {formatPaise(paise)}
                      </button>
                    ))}
                    <input
                      className="field !w-[130px] !py-1.5 !text-[12px]"
                      placeholder="Custom ₹"
                      value={custom}
                      onChange={(event) => setCustom(event.target.value.replace(/[^\d.]/g, ""))}
                      aria-label="Custom amount in rupees"
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-ink-mute">
                    Sent to the gateway as <span className="font-mono text-ink-soft">{payAmount} paise</span>.
                  </p>
                </div>

                <div>
                  <p className="label">Payment method</p>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                    {[
                      { id: "UPI" as const, label: "UPI QR", icon: "qr", note: "Dynamic, single-use" },
                      { id: "CASH_COUNTER" as const, label: "Cash at till", icon: "wallet", note: "Cashier confirms" },
                      { id: "CARD_COUNTER" as const, label: "Card at POS", icon: "receipt", note: "Terminal + staff" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setMethod(option.id)}
                        aria-pressed={method === option.id}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left transition",
                          method === option.id
                            ? "border-brand bg-brand-soft"
                            : "border-line bg-white hover:border-ink/25",
                        )}
                      >
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                          <Icon name={option.icon} className="h-3.5 w-3.5" />
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] text-ink-mute">{option.note}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="label">Demo scenario</p>
                  <div className="mt-1.5 grid gap-1.5">
                    {outcomes.map((option) => (
                      <label
                        key={option.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 transition",
                          outcome === option.id
                            ? "border-ink bg-paper-deep"
                            : "border-line bg-white hover:border-ink/20",
                        )}
                      >
                        <input
                          type="radio"
                          name="outcome"
                          className="mt-1 accent-[#0B5E4F]"
                          checked={outcome === option.id}
                          onChange={() => setOutcome(option.id)}
                        />
                        <span>
                          <span className="block text-[12px] font-semibold text-ink">{option.label}</span>
                          <span className="block text-[10.5px] text-ink-mute">{option.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button onClick={create} className="btn-primary w-full">
                  <Icon name="qr" className="h-4 w-4" />
                  Create {method === "UPI" ? "UPI QR" : "counter session"} for {formatPaise(payAmount)}
                </button>

                <div className="flex items-center justify-between text-[11px] text-ink-mute">
                  <button onClick={resetOtp} className="underline decoration-line-strong underline-offset-4">
                    Use a different number
                  </button>
                  <span>
                    Slot: {activeSlot ? <span className="font-semibold text-warn">in use</span> : "free"} · queue{" "}
                    {queue.length}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Callout tone="warn" title="Sandbox rules">
            The QR encodes a demo VPA on purpose. There is no bank, no UPI merchant account and no webhook
            receiver attached, so nothing can settle and no money can move. Every status here is produced by the
            demo state machine in your browser.
          </Callout>
        </div>

        {/* ------------------------------------------------- right column */}
        <aside className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-[12px] font-semibold text-ink">Behind the glass</p>
              <span className="font-mono text-[10px] text-ink-mute">/api/v1/payments</span>
            </div>
            {session ? (
              <dl className="divide-y divide-line text-[12px]">
                {[
                  ["session id", session.id],
                  ["order id", session.orderId],
                  ["amount (paise)", String(session.amountPaise)],
                  ["status", <StatusPill key="s" status={session.status} />],
                  [
                    "pay window",
                    session.status === "ACTIVE"
                      ? mmss(Math.max(0, Math.ceil((session.payDeadline - now) / 1000)))
                      : "—",
                  ],
                  [
                    "verify window",
                    session.status === "PROCESSING" && session.verifyDeadline
                      ? mmss(Math.max(0, Math.ceil((session.verifyDeadline - now) / 1000)))
                      : "—",
                  ],
                  ["queue position", session.queuePos ? `#${session.queuePos}` : "slot holder"],
                  ["utr", session.utr ?? "—"],
                  ["created", relativeTime(session.createdAt, now)],
                ].map(([key, value]) => (
                  <div key={String(key)} className="flex items-center justify-between gap-3 px-4 py-2">
                    <dt className="text-ink-mute">{key}</dt>
                    <dd className="max-w-[62%] truncate text-right font-mono text-[11px] text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-4 py-6 text-[12px] text-ink-mute">
                No session yet. Create one to watch the server-side fields.
              </p>
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="label">Observer stream</p>
              <span className="flex gap-1">
                {state.observers.map((o) => (
                  <StatusPill key={o.channel} status={o.status} />
                ))}
              </span>
            </div>
            <ul className="mt-2.5 space-y-2">
              {state.events.slice(0, 4).map((event) => (
                <li key={event.id} className="rounded-lg border border-line bg-paper px-2.5 py-2">
                  <div className="flex items-center justify-between text-[10.5px] text-ink-mute">
                    <span className="font-semibold uppercase tracking-[0.1em]">{event.channel}</span>
                    <span>{relativeTime(event.receivedAt, now)}</span>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-ink-soft">{event.raw}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[10.5px]">
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 font-semibold",
                        event.verdict === "matched"
                          ? "bg-[#E7F4EE] text-ok"
                          : event.verdict === "amount-mismatch"
                            ? "bg-[#FBEBE9] text-bad"
                            : "bg-paper-deep text-ink-mute",
                      )}
                    >
                      {event.verdict}
                    </span>
                    <span className="mono-nums text-ink-mute">{formatPaise(event.amountPaise)}</span>
                  </p>
                </li>
              ))}
              {state.events.length === 0 && <li className="text-[12px] text-ink-mute">No observations yet.</li>}
            </ul>
          </div>

          <div className="card p-4">
            <p className="label">Next steps</p>
            <div className="mt-2 space-y-2">
              <Link href="/outcomes" className="btn-ghost w-full !justify-start !text-[12px]">
                <Icon name="layers" className="h-3.5 w-3.5" /> Browse the 5 outcome pages
              </Link>
              <Link href="/admin/payments" className="btn-ghost w-full !justify-start !text-[12px]">
                <Icon name="receipt" className="h-3.5 w-3.5" /> See this session in the ledger
              </Link>
              <Link href="/admin/observers" className="btn-ghost w-full !justify-start !text-[12px]">
                <Icon name="signal" className="h-3.5 w-3.5" /> Inspect the observer mesh
              </Link>
              <Link href="/admin/webhooks" className="btn-ghost w-full !justify-start !text-[12px]">
                <Icon name="webhook" className="h-3.5 w-3.5" /> Verify a signed webhook
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
