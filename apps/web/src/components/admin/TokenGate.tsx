// Purpose: Admin token gate — token sessionStorage me, verify admin API se

"use client";

import { useEffect, useState } from "react";
import { adminFetch, adminToken, saveAdminToken } from "@/lib/admin-client";

export function TokenGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(token: string) {
    setBusy(true);
    setError(null);
    try {
      saveAdminToken(token);
      await adminFetch("/api/admin/settings");
      setAuthorized(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Token galat hai.");
      setAuthorized(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const existing = adminToken();
    setReady(true);
    if (existing) void verify(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return <p className="muted">…</p>;

  if (!authorized) {
    return (
      <form
        className="panel"
        style={{ maxWidth: 460 }}
        onSubmit={(event) => {
          event.preventDefault();
          void verify(input);
        }}
      >
        <h2 style={{ fontSize: 17, marginBottom: 8 }}>Admin token</h2>
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Token sirf is tab ke session me rehta hai (sessionStorage). Kabhi URL me nahi jaata.
        </p>
        <input
          className="input"
          type="password"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="ADMIN_API_TOKEN"
          autoComplete="off"
          required
        />
        {error ? <div className="note error" style={{ marginTop: 12 }}>{error}</div> : null}
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? "Check…" : "Unlock"}
        </button>
      </form>
    );
  }

  return <>{children}</>;
}
