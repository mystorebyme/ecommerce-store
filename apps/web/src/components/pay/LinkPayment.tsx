// Purpose: Payment link ka client flow — details → QR → live status → success
//
// Security: amount server se aata hai (`/api/pay/links/:token` POST). Browser kabhi
// apna amount "decide" nahi karta — fixed link par bheja hua amount server ignore karta hai.
// Confirm sirf server se (observer/manual) — browser ka claim trust nahi hota.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rupees, type PaymentSession, type PublicLink } from "@/lib/api";
import { CountUp } from "./CountUp";
import { ProgressRing } from "./ProgressRing";

type Phase = "details" | "creating" | "paying" | "error";

export function LinkPayment({ link }: { link: PublicLink }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amountRupees, setAmountRupees] = useState("");
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const idemKey = useRef(`link-${crypto.randomUUID()}`);

  const isOpen = link.kind === "OPEN";
  const min = link.minAmountPaise ?? 100;
  const max = link.maxAmountPaise ?? 5_000_000;
  const typedPaise = Math.round(Number(amountRupees || 0) * 100);
  const amountValid = !isOpen || (Number.isInteger(typedPaise) && typedPaise >= min && typedPaise <= max);

  const start = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setPhase("creating");
      try {
        const response = await fetch(`/api/pay/links/${encodeURIComponent(link.token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customerName: name.trim(),
            customerPhone: phone.replace(/\D/g, "").slice(-10),
            ...(isOpen ? { amountPaise: typedPaise } : {}),
          }),
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error?.message ?? "Payment shuru nahi hua.");
        }
        setSession(json.data.payment as PaymentSession);
        setPhase("paying");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Kuch galat ho gaya.");
        setPhase("error");
      }
    },
    [isOpen, link.token, name, phone, typedPaise],
  );

  // Live status polling
  useEffect(() => {
    if (phase !== "paying" || !session) return;
    if (!["QUEUED", "ACTIVE", "PROCESSING"].includes(session.status)) return;

    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`/api/payments/${session.sessionId}`, { cache: "no-store" });
        if (!response.ok) return;
        const json = await response.json();
        if (stopped) return;
        const fresh = json.data as PaymentSession;
        setSession(fresh);
        if (fresh.status === "SUCCESS") {
          clearInterval(timer);
          router.push(`/checkout/success?session=${fresh.sessionId}`);
        }
      } catch {
        /* agla tick */
      }
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [phase, session?.sessionId, session?.status, router]);

  // Countdown
  useEffect(() => {
    if (!session) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((new Date(session.payExpiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.payExpiresAt]);

  const expired = session ? secondsLeft === 0 && !["SUCCESS", "PROCESSING"].includes(session.status) : false;
  // Ring ka denominator: session ke first response ka poora window (300s default).
  const totalWindow = Math.max(1, session?.secondsLeftToPay ?? 300, secondsLeft);
  const progress = Math.max(0, Math.min(1, secondsLeft / totalWindow));

  if (phase === "details" || phase === "creating" || phase === "error") {
    return (
      <form className="panel" onSubmit={start}>
        <div className="amount-hero">
          <p className="muted" style={{ fontSize: 13 }}>Amount</p>
          <div className="amount-big">
            {isOpen ? (
              <span className="input-rupee">
                ₹
                <input
                  aria-label="Amount in rupees"
                  className="input amount-input"
                  inputMode="decimal"
                  value={amountRupees}
                  onChange={(event) => setAmountRupees(event.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0"
                  required
                />
              </span>
            ) : (
              <CountUp paise={link.amountPaise ?? 0} />
            )}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            {isOpen
              ? `Allowed: ${rupees(min)} – ${rupees(max)}`
              : "Amount merchant ne lock kiya hai — badla nahi ja sakta."}
          </p>
          {isOpen ? (
            <div className="chips">
              {[10000, 50000, 100000].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="chip"
                  onClick={() => setAmountRupees(String(chip / 100))}
                  disabled={chip < min || chip > max}
                >
                  {rupees(chip)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="form-row">
          <label htmlFor="link-name">Full name</label>
          <input id="link-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength={2} required />
        </div>
        <div className="form-row">
          <label htmlFor="link-phone">Mobile number</label>
          <input
            id="link-phone"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            autoComplete="tel"
            pattern="[0-9+ ]{10,15}"
            required
          />
        </div>

        {error ? <div className="note error" style={{ marginBottom: 12 }}>{error}</div> : null}

        <button className="btn btn-block" type="submit" disabled={phase === "creating" || !amountValid}>
          {phase === "creating" ? "QR ban raha hai…" : isOpen ? `Pay ${rupees(typedPaise)} with UPI` : `Pay ${rupees(link.amountPaise ?? 0)} with UPI`}
        </button>

        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Payee: <strong>{link.payee.name}</strong> · <span className="mono">{link.payee.vpa}</span>
        </p>
      </form>
    );
  }

  if (!session) return null;

  return (
    <div className="panel">
      <div className="pay-head">
        <ProgressRing progress={progress} secondsLeft={secondsLeft} state={expired ? "expired" : "waiting"} size={86} />
        <div>
          <h2 style={{ fontSize: 18 }}>{expired ? "QR expire ho gaya" : "Scan & pay"}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            {expired ? "Naya QR banane ke liye merchant se naya link lo." : "Page khula rakho — payment 2–5 second me confirm ho jaata hai."}
          </p>
          <p className="mono" style={{ marginTop: 6, fontSize: 13 }}>Ref {session.reference}</p>
        </div>
      </div>

      <div className="qr-wrap" style={{ marginTop: 14 }}>
        {session.upi.dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.upi.dataUrl} alt={`UPI QR for ${rupees(session.amountPaise)}`} width={220} height={220} className="qr-pop" />
        ) : (
          <span className="muted">QR generate nahi hua</span>
        )}
      </div>

      <div className="summary-row" style={{ marginTop: 10 }}>
        <span>Amount</span>
        <span className="price">
          <CountUp paise={session.amountPaise} />
        </span>
      </div>
      <div className="summary-row">
        <span>Pay to</span>
        <span className="mono">{session.vpa}</span>
      </div>
      <div className="summary-row">
        <span>Note</span>
        <span className="mono">{session.reference}</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <a className="btn" href={session.upi.string} style={{ flex: 1 }}>
          Open UPI app
        </a>
      </div>

      <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
        Exact {rupees(session.amountPaise)} pay karo — kam ya zyada bhejne par payment match nahi hoga.
      </p>
    </div>
  );
}
