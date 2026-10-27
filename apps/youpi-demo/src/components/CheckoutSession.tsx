"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { formatPaise, mmss, clockTime, randomUtr, cn, readableOn } from "@/lib/format";
import { useDemo } from "@/lib/store";
import type { Session } from "@/lib/types";
import { Icon, StatusPill } from "./ui";

function upiUri(vpa: string, name: string, amountPaise: number, orderId: string): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: `YouPI demo ${orderId}`,
  });
  return `upi://pay?${params.toString()}`;
}

export function QrCanvas({ value, size = 196 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0C1116", light: "#FFFFFF" },
    })
      .then((markup) => {
        if (alive) setSvg(markup);
      })
      .catch(() => setSvg(""));
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div
      className="grid place-items-center overflow-hidden rounded-xl border border-line bg-white p-2"
      style={{ width: size + 16, height: size + 16 }}
      aria-label="Dynamic UPI QR code for this payment session"
      role="img"
    >
      {svg ? (
        <div
          className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
          // The markup comes from the qrcode library, not from user input.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-paper-deep" />
      )}
    </div>
  );
}

export function CheckoutPanel({ session, compact = false }: { session: Session; compact?: boolean }) {
  const { state, now, checkPayment, cancelSession } = useDemo();
  const [copied, setCopied] = useState(false);

  const paySeconds = Math.max(0, Math.ceil((session.payDeadline - now) / 1000));
  const verifySeconds = session.verifyDeadline
    ? Math.max(0, Math.ceil((session.verifyDeadline - now) / 1000))
    : 0;

  const uri = useMemo(
    () => upiUri(state.activeVpa, state.branding.appName, session.amountPaise, session.orderId),
    [state.activeVpa, state.branding.appName, session.amountPaise, session.orderId],
  );

  const progress =
    session.status === "PROCESSING"
      ? Math.min(100, ((30 - verifySeconds) / 30) * 100)
      : Math.min(100, ((300 - paySeconds) / 300) * 100);

  if (session.status === "QUEUED") {
    return (
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between">
          <StatusPill status="QUEUED" />
          <span className="mono-nums text-[12px] text-ink-mute">{formatPaise(session.amountPaise)}</span>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border border-line-strong bg-paper">
            <span className="mono-nums text-lg font-semibold text-ink">{session.queuePos ?? 1}</span>
            <span className="absolute inset-0 animate-pulseRing rounded-full border border-accent/60" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              You are #{session.queuePos ?? 1} in the queue
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">
              One buyer pays on a UPI handle at a time, so two identical amounts can never be confused. This slot
              promotes automatically the second it frees up.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-line bg-paper px-3.5 py-3 text-[12px] text-ink-soft">
          Order <span className="font-mono">{session.orderId}</span> is held. Keep this tab open — the queue
          position updates live.
        </div>
        <button onClick={() => cancelSession(session.id)} className="btn-ghost mt-4 w-full !text-[12.5px]">
          Leave queue
        </button>
      </div>
    );
  }

  const finished = ["SUCCESS", "FAILED", "EXPIRED", "CANCELLED", "SUSPICIOUS", "REFUNDED"].includes(
    session.status,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div
        className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5"
        style={{ backgroundColor: state.branding.primaryColor, color: readableOn(state.branding.primaryColor) }}
      >
        <div className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded-md border text-[10px] font-bold"
            style={{
              borderColor: `${readableOn(state.branding.primaryColor)}44`,
              backgroundColor: `${readableOn(state.branding.primaryColor)}18`,
            }}
          >
            {state.branding.logoMark}
          </span>
          <span className="text-[11.5px] font-semibold">{state.branding.appName}</span>
        </div>
        <StatusPill status={session.status} />
      </div>

      <div className={cn("grid gap-4 p-4", !compact && "sm:grid-cols-[auto_1fr]")}>
        <div className="flex flex-col items-center gap-2">
          <QrCanvas value={uri} size={compact ? 150 : 188} />
          <p className="text-center text-[10.5px] leading-tight text-ink-mute">
            Scan with any UPI app
            <br />
            <span className="font-mono">{state.activeVpa}</span>
          </p>
        </div>

        <div className="min-w-0">
          <p className="label">Amount to pay</p>
          <p className="mono-nums mt-1 text-[30px] font-semibold leading-none tracking-tight text-ink">
            {formatPaise(session.amountPaise)}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-mute">
            Order <span className="font-mono text-ink-soft">{session.orderId}</span> ·{" "}
            {session.method === "UPI" ? "UPI" : session.method}
          </p>

          {(session.status === "ACTIVE" || session.status === "PROCESSING") && (
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-mute">
                  {session.status === "PROCESSING" ? "Verifying with bank observers" : "Payment window"}
                </span>
                <span
                  className={cn(
                    "mono-nums font-semibold",
                    (session.status === "PROCESSING" ? verifySeconds : paySeconds) < 30 ? "text-bad" : "text-ink",
                  )}
                >
                  {session.status === "PROCESSING" ? mmss(verifySeconds) : mmss(paySeconds)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-deep">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-1000 ease-linear",
                    session.status === "PROCESSING" ? "bg-accent" : "bg-brand",
                  )}
                  style={{ width: `${Math.max(2, 100 - progress)}%` }}
                />
              </div>
            </div>
          )}

          {session.status === "ACTIVE" && (
            <div className="mt-4 space-y-2">
              <button onClick={() => checkPayment(session.id)} className="btn-primary w-full !text-[13px]">
                <Icon name="check" className="h-4 w-4" />
                I have paid — check my payment
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(session.orderId).catch(() => undefined);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  }}
                  className="btn-ghost flex-1 !text-[11.5px]"
                >
                  <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy order id"}
                </button>
                <button onClick={() => cancelSession(session.id)} className="btn-ghost flex-1 !text-[11.5px]">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {session.status === "PROCESSING" && (
            <div className="mt-4 rounded-xl border border-[#F0DAB0] bg-[#FDF6E9] px-3 py-2.5">
              <p className="flex items-center gap-2 text-[11.5px] font-semibold text-warn">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-accent" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                Polling the observer stream
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-ink-soft">
                <li className="flex items-center gap-1.5">
                  <Icon name="check" className="h-3 w-3 text-ok" /> Android observer heartbeat {clockTime(now)}
                </li>
                <li className="flex items-center gap-1.5">
                  <Icon name="check" className="h-3 w-3 text-ok" /> Gmail observer watching credit alerts
                </li>
                <li className="flex items-center gap-1.5 text-ink-mute">
                  <Icon name="clock" className="h-3 w-3" /> Matching exact amount &amp; UTR…
                </li>
              </ul>
            </div>
          )}

          {finished && (
            <div className="mt-4">
              <a href={`/outcomes?state=${session.status.toLowerCase()}`} className="btn-dark w-full !text-[13px]">
                See the {session.status.toLowerCase()} outcome page
                <Icon name="arrow" className="h-4 w-4" />
              </a>
            </div>
          )}

          {session.utr && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-mute">
              <Icon name="shield" className="h-3.5 w-3.5 text-ok" />
              Bank UTR <span className="font-mono text-ink-soft">{session.utr}</span>
              {!session.utr.includes("X") && <span className="text-ok">· verified</span>}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-line bg-paper/70 px-4 py-2.5">
        <p className="flex items-center gap-1.5 text-[10.5px] text-ink-mute">
          <Icon name="lock" className="h-3 w-3" />
          Server-authoritative timers · demo QR points at a sandbox VPA, no funds can move
        </p>
      </div>
    </div>
  );
}

export function simulatedObservationNote() {
  return `Demo observation: ${randomUtr()}`;
}
