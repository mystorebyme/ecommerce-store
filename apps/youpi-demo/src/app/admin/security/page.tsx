"use client";

import { Callout, Icon, StatusPill } from "@/components/ui";
import { dateTime, relativeTime } from "@/lib/format";
import { useDemo } from "@/lib/store";

const roles = [
  { role: "owner", scope: "Everything: catalogue, money, staff, settings", tone: "bg-ink text-white" },
  { role: "manager", scope: "Catalogue, orders, inventory, reconciliation", tone: "bg-paper-deep text-ink" },
  { role: "support", scope: "Read orders, add notes, masked PII", tone: "bg-paper-deep text-ink" },
  { role: "viewer", scope: "Read-only dashboards and reports", tone: "bg-paper-deep text-ink" },
];

export default function SecurityPage() {
  const { state, now, unban } = useDemo();

  return (
    <div className="space-y-4">
      <div>
        <p className="label">Security</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">Bans, roles and the audit trail</h1>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-mute">
          Fraud handling is explicit rather than hidden: device fingerprints can be banned, sessions can be held,
          and every staff action lands in an append-only log.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="text-[12px] font-semibold text-ink">Device fingerprints</p>
            <span className="font-mono text-[10px] text-ink-mute">{state.bans.length} banned</span>
          </div>
          {state.bans.length === 0 ? (
            <p className="px-4 py-6 text-[11.5px] text-ink-mute">No fingerprints banned right now.</p>
          ) : (
            <ul className="divide-y divide-line">
              {state.bans.map((ban) => (
                <li key={ban.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-mono text-[11.5px] font-semibold text-ink">{ban.fingerprint}</p>
                    <p className="mt-0.5 max-w-sm text-[10.5px] leading-relaxed text-ink-mute">{ban.reason}</p>
                    <p className="mt-0.5 text-[9.5px] text-ink-mute">
                      {ban.hits} blocked attempts · {relativeTime(ban.at, now)}
                    </p>
                  </div>
                  <button
                    onClick={() => unban(ban.id)}
                    className="rounded-lg border border-line bg-white px-2.5 py-1 text-[10.5px] font-semibold text-ink-soft hover:text-ok"
                  >
                    Unban
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line bg-paper px-4 py-2.5">
            <p className="text-[10.5px] leading-relaxed text-ink-mute">
              Fingerprints are a combination of browser signals — never a substitute for authentication. They slow
              down repeat abuse; they do not stop a determined attacker.
            </p>
          </div>
        </div>

        <div className="card p-4">
          <p className="label">Role matrix</p>
          <ul className="mt-2 space-y-2">
            {roles.map((role) => (
              <li key={role.role} className="rounded-xl border border-line bg-paper px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${role.tone}`}>
                    {role.role}
                  </span>
                  <Icon name="shield" className="h-3.5 w-3.5 text-ink-mute" />
                </div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-ink-mute">{role.scope}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[10px] leading-relaxed text-ink-mute">
            Permissions are enforced by the API, not by hiding buttons. The same request from the wrong role returns
            403.
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {[
          {
            title: "Session & tokens",
            items: [
              "Short-lived access token, rotating refresh token",
              "httpOnly, secure, sameSite cookies",
              "Admin console on its own subdomain",
              "Idle logout after 20 minutes",
            ],
          },
          {
            title: "Payments",
            items: [
              "Amount always recomputed server-side",
              "Webhook secret separate from API key",
              "Idempotency-Key prevents duplicate sessions",
              "Refunds only through the payments module",
            ],
          },
          {
            title: "Data",
            items: [
              "Phone and email masked for support role",
              "No bulk PII export without owner + audit",
              "DPDP-style consent recorded at checkout",
              "Retention: ledgers 8 years, PII 24 months",
            ],
          },
        ].map((block) => (
          <div key={block.title} className="card p-4">
            <p className="text-[11.5px] font-semibold text-ink">{block.title}</p>
            <ul className="mt-2 space-y-1.5">
              {block.items.map((item) => (
                <li key={item} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink-soft">
                  <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-ok" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-[12px] font-semibold text-ink">Audit log (append-only)</p>
          <span className="font-mono text-[10px] text-ink-mute">{state.audit.length} entries</span>
        </div>
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-paper">
              <tr className="border-b border-line text-left text-[9.5px] uppercase tracking-[0.1em] text-ink-mute">
                <th className="px-4 py-2 font-semibold">When</th>
                <th className="px-3 py-2 font-semibold">Actor</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {state.audit.map((entry) => (
                <tr key={entry.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-1.5 whitespace-nowrap text-ink-mute">{dateTime(entry.at)}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-ink-soft">{entry.actor}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-ink">{entry.action}</td>
                  <td className="px-3 py-1.5 text-ink-mute">{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Callout tone="warn" title="This is a demo, not a security audit">
        The sandbox runs entirely in your browser. A real deployment needs server-side authorisation, rate limits,
        secret management, log retention, backups and an independent review before it touches real money.
      </Callout>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-4 py-3">
        <StatusPill status="online" />
        <span className="text-[11px] text-ink-mute">
          Sandbox status: {now % 2 === 0 ? "all systems nominal" : "all systems nominal"} · demo build
        </span>
      </div>
    </div>
  );
}
