// Purpose: Admin board — live payments dekho aur ek click me "mark paid" karo
//
// Kyun: bank SMS observer ke bina bhi merchant apna paisa confirm kar sake.
// Yahan jo "mark paid" hota hai wo bhi ek observation (source MANUAL) banta hai —
// isliye har confirmation ka record rehta hai (kaun, kab, kaunsa UTR).
//
// Security: admin token browser me sirf sessionStorage me rehta hai, kabhi URL/localStorage me nahi.

"use client";

import { useCallback, useEffect, useState } from "react";

interface SessionRow {
  sessionId: string;
  orderId: string;
  amountPaise: number;
  reference: string;
  status: string;
  utr: string | null;
  secondsLeftToPay: number;
  createdAt: string;
}

const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("youpi_admin_token");
    if (saved) setToken(saved);
    setReady(true);
  }, []);

  const load = useCallback(
    async (adminToken: string) => {
      setMessage(null);
      const response = await fetch("/api/admin/sessions?status=QUEUED,ACTIVE,PROCESSING,SUCCESS", {
        headers: { "x-admin-token": adminToken },
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok) {
        setMessage(json?.error?.message ?? "Sessions load nahi hue.");
        return;
      }
      setRows(json.data as SessionRow[]);
    },
    [],
  );

  async function saveToken(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = token.trim();
    sessionStorage.setItem("youpi_admin_token", trimmed);
    await load(trimmed);
  }

  async function confirm(sessionId: string) {
    const utr = window.prompt("Bank app se UTR / RRN daalo (9–18 digits)");
    if (!utr) return;
    setBusy(sessionId);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-token": token.trim() },
        body: JSON.stringify({ utr: utr.trim(), note: "Manual confirm — admin board" }),
      });
      const json = await response.json();
      setMessage(response.ok ? "✅ Payment confirm ho gaya (order PAID)." : (json?.error?.message ?? "Confirm fail hua."));
      await load(token.trim());
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="container">
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Admin — live payments</h1>
      <p className="muted" style={{ marginBottom: 10 }}>
        Bank SMS observer na chale to yahan se payment manually confirm karo. Har confirm ka record rehta hai.
      </p>
      <p style={{ marginBottom: 18, display: "flex", gap: 14, flexWrap: "wrap" }}>
        <a href="/admin/settings">⚙️ UPI settings + audit</a>
        <a href="/admin/links">🔗 Payment links</a>
        <a href="/pay/open">＋ Open payment page</a>
      </p>

      <form className="panel" onSubmit={saveToken} style={{ marginBottom: 18 }}>
        <label htmlFor="token" style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
          Admin token
        </label>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            id="token"
            className="input"
            style={{ flex: 1, minWidth: 220 }}
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="ADMIN_API_TOKEN"
            autoComplete="off"
          />
          <button className="btn" type="submit">
            Load
          </button>
        </div>
        {ready ? null : <p className="muted">…</p>}
      </form>

      {message ? <div className="note ok" style={{ marginBottom: 14 }}>{message}</div> : null}

      {rows.length === 0 ? (
        <p className="muted">Koi live session nahi mila. (Order karne ke baad yahan dikhega.)</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((row) => (
            <div
              key={row.sessionId}
              className="panel"
              style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{money(row.amountPaise)} · {row.status}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Order <span className="mono">{row.orderId}</span> · Ref <span className="mono">{row.reference}</span>
                  {row.utr ? <> · UTR <span className="mono">{row.utr}</span></> : null}
                </div>
              </div>
              {row.status === "SUCCESS" ? (
                <span className="badge">PAID</span>
              ) : (
                <button className="btn" type="button" onClick={() => confirm(row.sessionId)} disabled={busy === row.sessionId}>
                  {busy === row.sessionId ? "Confirm…" : "Mark paid"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="muted" style={{ marginTop: 24, fontSize: 13 }}>
        Tip: main page par “₹1 ka test payment” link se test order banao, UPI se ₹1 bhejo, phir yahan UTR daal ke confirm karo.
      </p>
    </main>
  );
}
