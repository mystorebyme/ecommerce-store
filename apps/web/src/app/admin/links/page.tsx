// Purpose: Admin — payment links banao (fixed/open), copy karo, band karo
//
// URL me sirf token jaata hai; amount server DB se aata hai (tamper-proof).

"use client";

import { useCallback, useEffect, useState } from "react";
import { TokenGate } from "@/components/admin/TokenGate";
import { adminFetch, rupees } from "@/lib/admin-client";

interface LinkRow {
  id: string;
  token: string;
  path: string;
  kind: "FIXED" | "OPEN";
  title: string;
  amountPaise: number | null;
  status: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
}

function LinksInner() {
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [kind, setKind] = useState<"FIXED" | "OPEN">("FIXED");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [expiresInHours, setExpiresInHours] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    setRows(await adminFetch<LinkRow[]>("/api/admin/links"));
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load().catch((error) => setMessage({ kind: "error", text: String(error.message ?? error) }));
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch<LinkRow>("/api/admin/links", {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: title.trim(),
          ...(kind === "FIXED" ? { amountPaise: Math.round(Number(amount) * 100) } : {}),
          ...(maxUses ? { maxUses: Number(maxUses) } : {}),
          ...(expiresInHours ? { expiresInHours: Number(expiresInHours) } : {}),
        }),
      });
      setTitle("");
      setAmount("");
      setMessage({ kind: "ok", text: "Link ban gaya — neeche list me se copy karo." });
      await load();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Link create fail." });
    } finally {
      setBusy(false);
    }
  }

  async function disable(id: string) {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/links/${id}/disable`, { method: "POST", body: "{}" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function copy(path: string) {
    await navigator.clipboard.writeText(`${origin}${path}`);
    setMessage({ kind: "ok", text: "Link copy ho gaya." });
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {message ? <div className={`note ${message.kind === "ok" ? "ok" : "error"}`}>{message.text}</div> : null}

      <section className="panel">
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Naya payment link</h2>
        <form onSubmit={create}>
          <div className="form-row">
            <label htmlFor="kind">Type</label>
            <select id="kind" className="input" value={kind} onChange={(event) => setKind(event.target.value as "FIXED" | "OPEN")}>
              <option value="FIXED">Fixed amount (customer badal nahi sakta)</option>
              <option value="OPEN">Open amount (customer khud daale)</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="title">Title</label>
            <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Advance booking — Diwali drop" required minLength={3} />
          </div>
          {kind === "FIXED" ? (
            <div className="form-row">
              <label htmlFor="amount">Amount (₹)</label>
              <input id="amount" className="input" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="500" required />
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>
              Open link ki min/max limits Settings page se aati hain.
            </p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="uses">Max uses</label>
              <input id="uses" className="input" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/[^\d]/g, ""))} />
            </div>
            <div className="form-row" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="expiry">Expires in (hours)</label>
              <input id="expiry" className="input" value={expiresInHours} onChange={(e) => setExpiresInHours(e.target.value.replace(/[^\d]/g, ""))} placeholder="48" />
            </div>
          </div>
          <button className="btn" type="submit" disabled={busy}>Create link</button>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Links</h2>
        {rows.length === 0 ? (
          <p className="muted">Abhi koi link nahi.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((row) => (
              <div key={row.id} className="panel" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {row.title} <span className="badge">{row.kind}</span>{" "}
                    {row.status !== "ACTIVE" ? <span className="badge">{row.status}</span> : null}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {row.amountPaise ? rupees(row.amountPaise) : "Open amount"} · used {row.usedCount}/{row.maxUses}
                    {row.expiresAt ? ` · till ${new Date(row.expiresAt).toLocaleString("en-IN")}` : ""}
                  </div>
                  <div className="mono" style={{ fontSize: 12 }}>{origin}{row.path}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost" type="button" onClick={() => copy(row.path)}>Copy</button>
                  {row.status === "ACTIVE" ? (
                    <button className="btn btn-ghost" type="button" onClick={() => disable(row.id)} disabled={busy}>Disable</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminLinksPage() {
  return (
    <main className="container">
      <h1 style={{ fontSize: 26, marginBottom: 6 }}>Admin — payment links</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Fixed amount ya open amount — link banao, copy karo, WhatsApp/ad par lagao.
      </p>
      <TokenGate>
        <LinksInner />
      </TokenGate>
    </main>
  );
}
