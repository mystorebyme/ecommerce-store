"use client";

import { useMemo, useState } from "react";
import { Drawer, EmptyState, Icon, StatusPill } from "@/components/ui";
import { cn, dateTime, formatPaise, relativeTime } from "@/lib/format";
import { useDemo } from "@/lib/store";
import type { SessionStatus } from "@/lib/types";

const statusFilters: (SessionStatus | "ALL")[] = [
  "ALL",
  "SUCCESS",
  "ACTIVE",
  "PROCESSING",
  "QUEUED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "SUSPICIOUS",
];

export default function AdminPayments() {
  const { state, now, adminConfirm, adminRefund, adminFail } = useDemo();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SessionStatus | "ALL">("ALL");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.sessions.filter((session) => {
      const matchesStatus = status === "ALL" || session.status === status;
      const matchesQuery =
        q === "" ||
        session.orderId.toLowerCase().includes(q) ||
        session.id.toLowerCase().includes(q) ||
        (session.utr ?? "").toLowerCase().includes(q) ||
        (session.customer?.phone ?? "").includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [state.sessions, query, status]);

  const selected = state.sessions.find((s) => s.id === openId) ?? null;

  const csv = useMemo(() => {
    const header = "order_id,amount_paise,status,utr,created_at";
    const rows = filtered.map(
      (s) => `${s.orderId},${s.amountPaise},${s.status},${s.utr ?? ""},${new Date(s.createdAt).toISOString()}`,
    );
    return [header, ...rows].join("\n");
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Payments</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">Ledger</h1>
          <p className="mt-1 text-[12px] text-ink-mute">
            Server-side filters · every row is a payment session, not a browser event.
          </p>
        </div>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(csv);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              setCopied(false);
            }
          }}
          className="btn-ghost !py-2 !text-[11.5px]"
        >
          <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" />
          {copied ? "CSV copied" : "Export CSV"}
        </button>
      </div>

      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="receipt" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
            <input
              className="field !py-2 !pl-8 !text-[12px]"
              placeholder="Search order, session id, UTR or phone"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search payments"
            />
          </div>
          <div className="scroll-thin flex gap-1 overflow-x-auto">
            {statusFilters.map((item) => (
              <button
                key={item}
                onClick={() => setStatus(item)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold",
                  status === item
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink-soft hover:border-ink/25",
                )}
              >
                {item === "ALL" ? "All" : item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No payments match"
          copy="Change the status filter or clear the search. New sandbox sessions appear here the moment they are created."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="border-b border-line bg-paper text-left text-[9.5px] uppercase tracking-[0.1em] text-ink-mute">
                  <th className="px-4 py-2 font-semibold">Order</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Method</th>
                  <th className="px-3 py-2 font-semibold">UTR</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((session) => (
                  <tr key={session.id} className="border-b border-line/70 last:border-0 hover:bg-paper/60">
                    <td className="px-4 py-2">
                      <span className="font-mono text-ink">{session.orderId}</span>
                      <span className="block text-[9.5px] text-ink-mute">{session.source}</span>
                    </td>
                    <td className="mono-nums px-3 py-2 font-semibold text-ink">
                      {formatPaise(session.amountPaise)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={session.status} />
                    </td>
                    <td className="px-3 py-2 text-[10.5px] text-ink-mute">{session.method}</td>
                    <td className="px-3 py-2 font-mono text-[10.5px] text-ink-mute">{session.utr ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-mute">{relativeTime(session.createdAt, now)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setOpenId(session.id)}
                        className="rounded-lg border border-line bg-white px-2 py-1 text-[10.5px] font-semibold text-ink-soft hover:text-ink"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[10.5px] text-ink-mute">
            <span>
              Showing {filtered.length} of {state.sessions.length} sessions
            </span>
            <span className="font-mono">page 1 / 1</span>
          </div>
        </div>
      )}

      <Drawer open={Boolean(selected)} onClose={() => setOpenId(null)} title="Payment session">
        {selected && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="label">Order</p>
                <p className="mt-0.5 font-mono text-[14px] font-semibold text-ink">{selected.orderId}</p>
              </div>
              <StatusPill status={selected.status} />
            </div>

            <p className="mono-nums text-[26px] font-semibold leading-none text-ink">
              {formatPaise(selected.amountPaise)}
            </p>

            <dl className="divide-y divide-line rounded-xl border border-line bg-white text-[11.5px]">
              {[
                ["Session id", selected.id],
                ["Method", selected.method],
                ["Customer", selected.customer ? `${selected.customer.name} · ${selected.customer.phone}` : "unknown"],
                ["Created", dateTime(selected.createdAt)],
                ["UTR", selected.utr ?? "—"],
                ["Source", selected.source],
                ["Reason", selected.reason ?? "—"],
              ].map(([key, value]) => (
                <div key={String(key)} className="flex items-start justify-between gap-3 px-3 py-2">
                  <dt className="text-ink-mute">{key}</dt>
                  <dd className="max-w-[62%] break-words text-right font-mono text-[10.5px] text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            {selected.status === "SUCCESS" && (
              <div className="rounded-xl border border-[#BBDFCE] bg-[#EDF7F1] px-3 py-2.5 text-[11px] text-ok">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Icon name="check" className="h-3.5 w-3.5" /> Webhook delivered &amp; signed
                </p>
                <p className="mt-1 text-ink-soft">
                  Fulfilment is only safe after your server verifies the signature on the raw body.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="label">Staff actions (audited)</p>
              <div className="grid gap-2">
                <button
                  onClick={() => {
                    adminConfirm(selected.id);
                    setOpenId(null);
                  }}
                  disabled={selected.status === "SUCCESS" || selected.status === "REFUNDED"}
                  className="btn-primary !text-[12px]"
                >
                  <Icon name="check" className="h-3.5 w-3.5" /> Confirm payment manually
                </button>
                <button
                  onClick={() => {
                    adminRefund(selected.id);
                    setOpenId(null);
                  }}
                  disabled={selected.status !== "SUCCESS"}
                  className="btn-ghost !text-[12px]"
                >
                  <Icon name="receipt" className="h-3.5 w-3.5" /> Issue refund
                </button>
                <button
                  onClick={() => {
                    adminFail(selected.id);
                    setOpenId(null);
                  }}
                  disabled={["SUCCESS", "REFUNDED", "FAILED", "CANCELLED"].includes(selected.status)}
                  className="btn-ghost !text-[12px] !text-bad"
                >
                  <Icon name="x" className="h-3.5 w-3.5" /> Mark as failed
                </button>
              </div>
              <p className="text-[10px] leading-relaxed text-ink-mute">
                Refunds only ever move through the payments module — never by editing a payment row. Every action
                above writes to the audit log.
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
