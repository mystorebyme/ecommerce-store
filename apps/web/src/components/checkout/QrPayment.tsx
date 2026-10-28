// Purpose: QR dikhana + live status (paid/failed/expired) + naya QR button
//
// Poora real flow — koi mock nahi:
//   1. POST /api/checkout   (Idempotency-Key)  → order + real UPI QR, ek hi round-trip me
//   2. GET  /api/payments/:id  har 1.5s        → SUCCESS hone tak
//
// Paisa confirm sirf tab hota hai jab bank SMS/observer us credit ko match kare —
// browser ka "paid" claim kabhi trust nahi hota.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { rupees, type PaymentSession, type Product } from "@/lib/api";

interface Props {
  product: Product;
}

type Phase = "details" | "creating" | "paying" | "error";

function errorText(status: number, code: string, message: string): string {
  if (code === "API_UNREACHABLE") return "Payment API se connection nahi bana. Thodi der baad try karo.";
  if (code === "ORDER_AMOUNT_MISMATCH") return "Amount mismatch — payment confirm nahi kiya gaya. Support ko batao.";
  if (code === "PRODUCT_OUT_OF_STOCK") return "Ye product abhi khatam ho gaya. Doosra choose karo.";
  if (status >= 500) return "Server error. Aapka paisa na kata ho to hi dobara try karo.";
  return message;
}

export function QrPayment({ product }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("details");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [cancelling, setCancelling] = useState(false);

  // Ek checkout attempt ka idempotency key — retry par naya order na bane.
  const idempotencyKey = useRef<string>("");
  if (!idempotencyKey.current) {
    idempotencyKey.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `web-${crypto.randomUUID()}`
        : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const start = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      setPhase("creating");

      try {
        // Ek hi request: order banao + UPI QR lo (do round-trip → ek).
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json", "idempotency-key": idempotencyKey.current },
          body: JSON.stringify({
            customerName: name.trim(),
            customerPhone: phone.replace(/\D/g, "").slice(-10),
            items: [{ productId: product.id, qty: 1 }],
          }),
        });

        const json = await response.json();
        if (!response.ok || !json?.data?.payment) {
          const code = json?.error?.code ?? (json?.meta?.paymentError ? "PAYMENT_FAILED" : "ORDER_FAILED");
          throw new Error(
            errorText(response.status, code, json?.error?.message ?? json?.meta?.paymentError ?? "Order nahi bana."),
          );
        }

        setSession(json.data.payment as PaymentSession);
        setPhase("paying");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Kuch galat ho gaya.");
        setPhase("error");
      }
    },
    [name, phone, product.id],
  );

  // Status polling — sirf jab QR live ho.
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
        /* network blip — agla tick try karega */
      }
    }, 1500);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [phase, session?.sessionId, session?.status, router]);

  // Countdown (server ke payExpiresAt se — browser ka clock sirf display ke liye).
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(session.payExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [session?.payExpiresAt]);

  async function cancelPayment() {
    if (!session) return;
    setCancelling(true);
    try {
      await fetch(`/api/payments/${session.sessionId}/cancel`, { method: "POST" });
    } finally {
      setCancelling(false);
      setSession(null);
      setPhase("details");
      idempotencyKey.current = `web-${crypto.randomUUID()}`;
    }
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const isQueued = session?.status === "QUEUED";
  const expired = session ? (session.status === "EXPIRED" || secondsLeft === 0) && session.status !== "SUCCESS" : false;

  return (
    <div className="panel">
      {phase === "details" || phase === "creating" || phase === "error" ? (
        <form onSubmit={start}>
          <h2 style={{ fontSize: 18 }}>Delivery details</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Order confirm karne ke liye naam aur mobile chahiye (delivery updates ke liye).
          </p>

          <div className="form-row" style={{ marginTop: 16 }}>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Aarav Sharma"
              autoComplete="name"
              minLength={2}
              required
            />
          </div>

          <div className="form-row">
            <label htmlFor="phone">Mobile number</label>
            <input
              id="phone"
              className="input"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="98765 43210"
              inputMode="numeric"
              autoComplete="tel"
              pattern="[0-9+ ]{10,15}"
              required
            />
            <span className="muted">Sirf delivery calls ke liye — OTP baad me.</span>
          </div>

          {error ? (
            <div className="note error" style={{ marginBottom: 14 }}>
              {error}
            </div>
          ) : null}

          <button className="btn btn-block" type="submit" disabled={phase === "creating"}>
            {phase === "creating" ? "Order ban raha hai…" : `Pay ${rupees(product.pricePaise)} with UPI`}
          </button>

          <div className="note ok" style={{ marginTop: 14 }}>
            Payment seedha <strong>hamare UPI</strong> par jaata hai — koi payment gateway nahi.
          </div>
        </form>
      ) : null}

      {phase === "paying" && session ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontSize: 18 }}>Scan &amp; pay</h2>
            <span className={`badge ${session.status === "QUEUED" ? "queued" : ""}`}>
              {session.status === "QUEUED" ? `Queue #${session.queuePosition}` : "QR live"}
            </span>
          </div>

          <div className="qr-wrap" style={{ marginTop: 14 }}>
            {session.upi.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.upi.dataUrl} alt={`UPI QR for ${rupees(session.amountPaise)}`} width={220} height={220} />
            ) : (
              <span className="muted">QR generate nahi hua</span>
            )}
          </div>

          <div className="timer" style={{ marginTop: 14 }}>
            <strong>
              {minutes}:{seconds}
            </strong>
            <span className="muted">{isQueued ? "mein aapki baari" : "mein pay karo"}</span>
          </div>

          <div className="summary-row" style={{ marginTop: 10 }}>
            <span>Amount</span>
            <span className="price">{rupees(session.amountPaise)}</span>
          </div>
          <div className="summary-row">
            <span>Pay to</span>
            <span className="mono">{session.vpa}</span>
          </div>
          <div className="summary-row">
            <span>Note (reference)</span>
            <span className="mono">{session.reference}</span>
          </div>

          {isQueued ? (
            <div className="note warn" style={{ marginTop: 12 }}>
              {session.aheadInQueue} buyer aage hain — inka payment complete hote hi aapka QR live ho jayega
              (ye page khula rakho).
            </div>
          ) : null}

          {expired ? (
            <div className="note warn" style={{ marginTop: 12 }}>
              QR expire ho gaya. Naya QR banao — paisa kata ho to wo 5 minute me auto-refund nahi hota, support se
              claim karo.
            </div>
          ) : null}

          <ol className="steps">
            <li>UPI app (GPay / PhonePe / Paytm) se QR scan karo</li>
            <li>Exact {rupees(session.amountPaise)} pay karo — kam ya zyada nahi</li>
            <li>Note me <span className="mono">{session.reference}</span> dikhna chahiye</li>
            <li>Ye page khula rakho — payment 2-5 second me confirm ho jayega</li>
          </ol>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <a className="btn" href={session.upi.string} style={{ flex: 1 }}>
              Open UPI app
            </a>
            <button className="btn btn-ghost" type="button" onClick={cancelPayment} disabled={cancelling}>
              {cancelling ? "Cancel…" : "Cancel"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
