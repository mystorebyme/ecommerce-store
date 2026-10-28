// Purpose: Open amount payment — validation client + server par (server hi final hai)

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { rupees, type PaymentSession } from "@/lib/api";
import { CountUp } from "./CountUp";
import { ProgressRing } from "./ProgressRing";

export function OpenPayment({ minAmountPaise, maxAmountPaise }: { minAmountPaise: number; maxAmountPaise: number }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const paise = Math.round(Number(amount || 0) * 100);
  const valid = Number.isInteger(paise) && paise >= minAmountPaise && paise <= maxAmountPaise;

  const start = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const response = await fetch("/api/pay/open", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amountPaise: paise,
            customerName: name.trim(),
            customerPhone: phone.replace(/\D/g, "").slice(-10),
          }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error?.message ?? "Payment shuru nahi hua.");
        setSession(json.data.payment as PaymentSession);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Kuch galat ho gaya.");
      } finally {
        setBusy(false);
      }
    },
    [name, paise, phone],
  );

  useEffect(() => {
    if (!session) return;
    if (!["QUEUED", "ACTIVE", "PROCESSING"].includes(session.status)) return;
    let stopped = false;
    const timer = setInterval(async () => {
      const response = await fetch(`/api/payments/${session.sessionId}`, { cache: "no-store" }).catch(() => null);
      if (!response?.ok || stopped) return;
      const json = await response.json();
      const fresh = json.data as PaymentSession;
      setSession(fresh);
      if (fresh.status === "SUCCESS") {
        clearInterval(timer);
        router.push(`/checkout/success?session=${fresh.sessionId}`);
      }
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session?.sessionId, session?.status, router]);

  useEffect(() => {
    if (!session) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(session.payExpiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.payExpiresAt]);

  if (session) {
    const totalWindow = Math.max(1, session.secondsLeftToPay || 300, secondsLeft);
    return (
      <div className="panel">
        <div className="pay-head">
          <ProgressRing progress={Math.min(1, secondsLeft / totalWindow)} secondsLeft={secondsLeft} size={86} />
          <div>
            <h2 style={{ fontSize: 18 }}>Scan &amp; pay</h2>
            <p className="mono" style={{ fontSize: 13 }}>Ref {session.reference}</p>
          </div>
        </div>
        <div className="qr-wrap" style={{ marginTop: 14 }}>
          {session.upi.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.upi.dataUrl} alt="UPI QR" width={220} height={220} className="qr-pop" />
          ) : null}
        </div>
        <div className="summary-row">
          <span>Amount</span>
          <span className="price"><CountUp paise={session.amountPaise} /></span>
        </div>
        <div className="summary-row">
          <span>Pay to</span>
          <span className="mono">{session.vpa}</span>
        </div>
        <a className="btn" href={session.upi.string} style={{ marginTop: 16, display: "block", textAlign: "center" }}>
          Open UPI app
        </a>
      </div>
    );
  }

  return (
    <form className="panel" onSubmit={start}>
      <div className="form-row">
        <label htmlFor="open-amount">Amount (₹)</label>
        <input
          id="open-amount"
          className="input"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
          placeholder="500"
          required
        />
        <span className="muted">
          {rupees(minAmountPaise)} – {rupees(maxAmountPaise)}
        </span>
      </div>
      <div className="form-row">
        <label htmlFor="open-name">Full name</label>
        <input id="open-name" className="input" value={name} onChange={(e) => setName(e.target.value)} minLength={2} required />
      </div>
      <div className="form-row">
        <label htmlFor="open-phone">Mobile number</label>
        <input
          id="open-phone"
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="numeric"
          pattern="[0-9+ ]{10,15}"
          required
        />
      </div>
      {error ? <div className="note error">{error}</div> : null}
      <button className="btn btn-block" type="submit" disabled={busy || !valid}>
        {busy ? "QR ban raha hai…" : `Pay ${rupees(valid ? paise : 0)} with UPI`}
      </button>
    </form>
  );
}
