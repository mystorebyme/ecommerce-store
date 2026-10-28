// Purpose: Admin — UPI settings (VPA change ₹1 test ke baad hi live) + limits + audit log
//
// Flow (ADR-0012):
//   1. Naya VPA stage karo → purana VPA LIVE rehta hai
//   2. "₹1 test QR" banao → us pending VPA par ₹1 bhejo
//   3. Payment settle hone par naya VPA apne aap live (ya "Confirm" se manual)
// Har step audit log me append hota hai.

"use client";

import { useCallback, useEffect, useState } from "react";
import { TokenGate } from "@/components/admin/TokenGate";
import { adminFetch, rupees } from "@/lib/admin-client";

interface SettingsView {
  merchant: { name: string; vpa: string; payeeName: string; merchantCode: string | null; payWindowSeconds: number } | null;
  pendingVpa: string | null;
  pendingPayeeName: string | null;
  pendingMerchantCode: string | null;
  pendingSince: string | null;
  limits: { minAmountPaise: number; maxAmountPaise: number };
}

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  before: string | null;
  after: string | null;
  createdAt: string;
}

interface SessionView {
  sessionId: string;
  amountPaise: number;
  upi: { string: string; dataUrl: string | null };
  status: string;
}

function SettingsInner() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [vpa, setVpa] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [minRupees, setMinRupees] = useState("1");
  const [maxRupees, setMaxRupees] = useState("50000");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [testQr, setTestQr] = useState<SessionView | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [settings, logs] = await Promise.all([
      adminFetch<SettingsView>("/api/admin/settings"),
      adminFetch<AuditRow[]>("/api/admin/settings/audit?limit=25"),
    ]);
    setView(settings);
    setAudit(logs);
    setMinRupees(String(settings.limits.minAmountPaise / 100));
    setMaxRupees(String(settings.limits.maxAmountPaise / 100));
  }, []);

  useEffect(() => {
    void load().catch((error) => setMessage({ kind: "error", text: String(error.message ?? error) }));
  }, [load]);

  async function stage(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch<SettingsView>("/api/admin/settings/vpa", {
        method: "POST",
        body: JSON.stringify({
          vpa: vpa.trim(),
          ...(payeeName.trim() ? { payeeName: payeeName.trim() } : {}),
          ...(merchantCode.trim() ? { merchantCode: merchantCode.trim() } : {}),
        }),
      });
      setVpa("");
      setMerchantCode("");
      setMessage({ kind: "ok", text: "Naya VPA pending hai. Ab ₹1 test karo — tabhi ye live hoga." });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Stage fail hua." });
    } finally {
      setBusy(false);
    }
  }

  async function startTest() {
    setBusy(true);
    setMessage(null);
    try {
      const session = await adminFetch<SessionView>("/api/admin/settings/vpa/test", { method: "POST", body: "{}" });
      setTestQr(session);
      setMessage({ kind: "ok", text: "Pending VPA par ₹1 ka QR ban gaya — ise scan karke ₹1 bhejo." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Test QR fail hua." });
    } finally {
      setBusy(false);
    }
  }

  async function confirmPending() {
    const utr = window.prompt("Bank app ka UTR / RRN (₹1 transaction)");
    if (!utr) return;
    setBusy(true);
    try {
      // ₹1 ka test session manual confirm — settlement hook khud VPA activate kar dega.
      if (testQr) {
        await adminFetch(`/api/admin/sessions/${testQr.sessionId}/confirm`, {
          method: "POST",
          body: JSON.stringify({ utr: utr.trim(), note: "VPA verification ₹1" }),
        });
      } else {
        await adminFetch("/api/admin/settings/vpa/confirm", { method: "POST", body: "{}" });
      }
      setTestQr(null);
      setMessage({ kind: "ok", text: "VPA verify ho gaya aur live hai." });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Confirm fail hua." });
    } finally {
      setBusy(false);
    }
  }

  async function cancelPending() {
    setBusy(true);
    try {
      await adminFetch("/api/admin/settings/vpa/cancel", { method: "POST", body: "{}" });
      setTestQr(null);
      setMessage({ kind: "ok", text: "Pending VPA hata diya — purana VPA hi live hai." });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveLimits(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await adminFetch("/api/admin/settings/limits", {
        method: "POST",
        body: JSON.stringify({
          minAmountPaise: Math.round(Number(minRupees) * 100),
          maxAmountPaise: Math.round(Number(maxRupees) * 100),
        }),
      });
      setMessage({ kind: "ok", text: "Open-link limits save ho gayi." });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Limits save fail." });
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <p className="muted">Loading…</p>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {message ? <div className={`note ${message.kind === "ok" ? "ok" : "error"}`}>{message.text}</div> : null}

      <section className="panel">
        <h2 style={{ fontSize: 18 }}>Live UPI</h2>
        <p className="mono" style={{ fontSize: 15, marginTop: 8 }}>{view.merchant?.vpa}</p>
        <p className="muted" style={{ fontSize: 13 }}>
          Payee: {view.merchant?.payeeName} · merchant code: {view.merchant?.merchantCode ?? "—"} · pay window{" "}
          {view.merchant?.payWindowSeconds}s
        </p>
        {view.pendingVpa ? (
          <div className="note warn" style={{ marginTop: 12 }}>
            <strong>Pending:</strong> <span className="mono">{view.pendingVpa}</span>
            {view.pendingPayeeName ? ` (${view.pendingPayeeName})` : ""} — ₹1 test ke baad hi live hoga.
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>UPI ID badlo (redeploy nahi chahiye)</h2>
        <form onSubmit={stage}>
          <div className="form-row">
            <label htmlFor="vpa">Naya UPI ID</label>
            <input id="vpa" className="input" value={vpa} onChange={(e) => setVpa(e.target.value)} placeholder="yourshop@okhdfcbank" required />
          </div>
          <div className="form-row">
            <label htmlFor="payee">Payee name (optional)</label>
            <input id="payee" className="input" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder={view.merchant?.payeeName ?? "YouPI Store"} />
          </div>
          <div className="form-row">
            <label htmlFor="mc">Merchant code `mc` (optional)</label>
            <input id="mc" className="input" value={merchantCode} onChange={(e) => setMerchantCode(e.target.value)} placeholder="5651" inputMode="numeric" />
          </div>
          <button className="btn" type="submit" disabled={busy}>Stage VPA</button>
        </form>

        {view.pendingVpa ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn" type="button" onClick={startTest} disabled={busy}>₹1 test QR banao</button>
              <button className="btn btn-ghost" type="button" onClick={confirmPending} disabled={busy}>Confirm (UTR daalo)</button>
              <button className="btn btn-ghost" type="button" onClick={cancelPending} disabled={busy}>Cancel</button>
            </div>
            {testQr?.upi.dataUrl ? (
              <div style={{ marginTop: 14 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={testQr.upi.dataUrl} alt="₹1 verification QR" width={180} height={180} className="qr-pop" />
                <p className="muted" style={{ fontSize: 13 }}>
                  {rupees(testQr.amountPaise)} bhejo — confirm hote hi naya VPA live.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Open payment limits</h2>
        <form onSubmit={saveLimits} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="min">Min (₹)</label>
            <input id="min" className="input" value={minRupees} onChange={(e) => setMinRupees(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="max">Max (₹)</label>
            <input id="max" className="input" value={maxRupees} onChange={(e) => setMaxRupees(e.target.value.replace(/[^\d]/g, ""))} />
          </div>
          <button className="btn" type="submit" disabled={busy}>Save</button>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Audit log (append-only)</h2>
        {audit.length === 0 ? (
          <p className="muted">Abhi koi entry nahi.</p>
        ) : (
          <ul className="audit-list">
            {audit.map((row) => (
              <li key={row.id}>
                <span className="badge">{row.action}</span>
                <span className="muted">{new Date(row.createdAt).toLocaleString("en-IN")}</span>
                <span className="mono" style={{ fontSize: 12 }}>{row.before ?? "—"} → {row.after ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <main className="container">
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Admin — UPI settings</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        VPA badalna, ₹1 verification, open-link limits aur audit trail.
      </p>
      <TokenGate>
        <SettingsInner />
      </TokenGate>
    </main>
  );
}
