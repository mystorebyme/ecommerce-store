"use client";

import Link from "next/link";
import { MiniBars, Icon, StatusPill } from "@/components/ui";
import { formatPaise, relativeTime } from "@/lib/format";
import { selectors, useDemo } from "@/lib/store";

const DAY = 86_400_000;

export default function AdminDashboard() {
  const { state, now, injectTestPayment } = useDemo();
  const stats = selectors.stats(state);
  const queue = selectors.queue(state);
  const activeSlot = selectors.active(state) ?? selectors.processing(state);

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const start = now - (6 - i) * DAY;
    return state.sessions
      .filter(
        (s) =>
          s.createdAt >= start &&
          s.createdAt < start + DAY &&
          (s.status === "SUCCESS" || s.status === "REFUNDED"),
      )
      .reduce((sum, s) => sum + s.amountPaise, 0);
  });

  const settleRate =
    stats.total === 0
      ? 0
      : Math.round(
          (state.sessions.filter((s) => s.status === "SUCCESS" || s.status === "REFUNDED").length /
            stats.total) *
            100,
        );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Overview</p>
          <h1 className="mt-1 text-[24px] font-semibold leading-tight text-ink">Good evening, Prakash</h1>
          <p className="mt-1 text-[12px] text-ink-mute">
            Sandbox ledger · {state.settings.merchantName} · {state.activeVpa}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => injectTestPayment(4900, "success")}
            className="btn-dark !py-2 !text-[11.5px]"
          >
            <Icon name="bug" className="h-3.5 w-3.5" /> Inject ₹49 test payment
          </button>
          <Link href="/checkout" className="btn-ghost !py-2 !text-[11.5px]">
            <Icon name="qr" className="h-3.5 w-3.5" /> New checkout
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Verified volume",
            value: formatPaise(stats.volume),
            hint: `${stats.paid.length} settled payments`,
            tone: "ok" as const,
          },
          {
            label: "Settlement rate",
            value: `${settleRate}%`,
            hint: "success + refunded vs all attempts",
            tone: "default" as const,
          },
          {
            label: "Active slot",
            value: activeSlot ? activeSlot.orderId : "free",
            hint: activeSlot ? `${formatPaise(activeSlot.amountPaise)} · ${activeSlot.status}` : "no buyer paying",
            tone: "warn" as const,
          },
          {
            label: "Queue depth",
            value: String(queue.length),
            hint: queue.length ? `next: ${queue[0]?.orderId}` : "nobody waiting",
            tone: "default" as const,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="label">{kpi.label}</p>
            <p
              className={`mono-nums mt-1.5 text-[21px] font-semibold leading-none ${
                kpi.tone === "ok" ? "text-ok" : kpi.tone === "warn" ? "text-warn" : "text-ink"
              }`}
            >
              {kpi.value}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-snug text-ink-mute">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="label">Settled volume · last 7 days</p>
              <p className="mono-nums mt-1 text-[16px] font-semibold text-ink">{formatPaise(stats.volume)}</p>
            </div>
            <span className="chip !text-[10px]">demo data</span>
          </div>
          <div className="mt-4">
            <MiniBars values={buckets} />
          </div>
          <div className="mt-2 flex justify-between text-[9.5px] uppercase tracking-[0.08em] text-ink-mute">
            {["6d", "5d", "4d", "3d", "2d", "1d", "today"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between">
            <p className="label">Observer mesh</p>
            <Link href="/admin/observers" className="text-[10.5px] font-semibold text-brand">
              inspect →
            </Link>
          </div>
          <ul className="mt-2.5 space-y-2">
            {state.observers.map((observer) => (
              <li key={observer.channel} className="rounded-xl border border-line bg-paper px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold text-ink">{observer.label}</span>
                  <StatusPill status={observer.status} />
                </div>
                <p className="mt-1 flex items-center justify-between text-[10.5px] text-ink-mute">
                  <span>{observer.metric}</span>
                  <span>{relativeTime(observer.lastHeartbeat, now)}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-[12px] font-semibold text-ink">Recent payments</p>
          <Link href="/admin/payments" className="text-[10.5px] font-semibold text-brand">
            full ledger →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="border-b border-line bg-paper text-left text-[9.5px] uppercase tracking-[0.1em] text-ink-mute">
                <th className="px-4 py-2 font-semibold">Order</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">UTR</th>
                <th className="px-3 py-2 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.slice(0, 6).map((session) => (
                <tr key={session.id} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-2 font-mono text-ink">{session.orderId}</td>
                  <td className="mono-nums px-3 py-2 font-semibold text-ink">
                    {formatPaise(session.amountPaise)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={session.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[10.5px] text-ink-mute">{session.utr ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-mute">{relativeTime(session.createdAt, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="label">Waiting in queue</p>
          {queue.length === 0 ? (
            <p className="mt-1.5 text-[11.5px] text-ink-mute">Nobody waiting — the single slot is free.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {queue.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[11px]"
                >
                  <span className="font-mono text-ink">
                    #{session.queuePos} · {session.orderId}
                  </span>
                  <span className="mono-nums font-semibold">{formatPaise(session.amountPaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-4">
          <p className="label">Latest audit entries</p>
          <ul className="mt-2 space-y-1.5">
            {state.audit.slice(0, 3).map((entry) => (
              <li key={entry.id} className="text-[11px] leading-snug text-ink-soft">
                <span className="font-mono text-[10px] text-ink-mute">{entry.action}</span> · {entry.detail}
                <span className="block text-[9.5px] text-ink-mute">
                  {entry.actor} · {relativeTime(entry.at, now)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
