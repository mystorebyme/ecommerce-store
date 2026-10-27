"use client";

import { useState } from "react";
import { Callout, CopyButton, Icon } from "@/components/ui";
import { useDemo } from "@/lib/store";

export default function SettingsPage() {
  const { state, updateSettings, rotateSecret, resetDemo } = useDemo();
  const [draft, setDraft] = useState(state.settings);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Settings</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">Gateway configuration</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-mute">
            Everything the checkout reads at runtime: merchant identity, windows, modes and keys. Changes are
            audited and take effect immediately in the demo.
          </p>
        </div>
        <button
          onClick={() => {
            updateSettings(draft);
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2000);
          }}
          className="btn-primary !py-2 !text-[11.5px]"
        >
          <Icon name={saved ? "check" : "gear"} className="h-3.5 w-3.5" />
          {saved ? "Saved" : "Save settings"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="card space-y-4 p-4">
          <p className="text-[12px] font-semibold text-ink">Merchant</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="merchant" className="label">
                Merchant name
              </label>
              <input
                id="merchant"
                className="field mt-1.5 !text-[12px]"
                value={draft.merchantName}
                onChange={(event) => setDraft({ ...draft, merchantName: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="vpa" className="label">
                Active UPI handle
              </label>
              <input
                id="vpa"
                className="field mt-1.5 font-mono !text-[11.5px]"
                value={draft.vpa}
                onChange={(event) => setDraft({ ...draft, vpa: event.target.value.trim() })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="payWindow" className="label">
                Payment window (seconds)
              </label>
              <input
                id="payWindow"
                type="number"
                min={60}
                max={900}
                className="field mt-1.5 !text-[12px]"
                value={draft.payWindowSeconds}
                onChange={(event) =>
                  setDraft({ ...draft, payWindowSeconds: Number(event.target.value) || 300 })
                }
              />
            </div>
            <div>
              <label htmlFor="verifyWindow" className="label">
                Verify window (seconds)
              </label>
              <input
                id="verifyWindow"
                type="number"
                min={10}
                max={120}
                className="field mt-1.5 !text-[12px]"
                value={draft.verifyWindowSeconds}
                onChange={(event) =>
                  setDraft({ ...draft, verifyWindowSeconds: Number(event.target.value) || 30 })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            {[
              {
                id: "testMode" as const,
                label: "Test mode",
                hint: "Show the sandbox banner and allow injected observations.",
              },
              {
                id: "allowCod" as const,
                label: "Allow cash on delivery",
                hint: "Buyers can place an order without prepaying.",
              },
              {
                id: "allowCounter" as const,
                label: "Counter mode (till + POS)",
                hint: "Cash and card collection with a cashier dock.",
              },
            ].map((toggle) => (
              <label
                key={toggle.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2.5"
              >
                <span>
                  <span className="block text-[11.5px] font-semibold text-ink">{toggle.label}</span>
                  <span className="block text-[10.5px] text-ink-mute">{toggle.hint}</span>
                </span>
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#0B5E4F]"
                  checked={draft[toggle.id]}
                  onChange={(event) => setDraft({ ...draft, [toggle.id]: event.target.checked })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <p className="text-[12px] font-semibold text-ink">Keys &amp; endpoint</p>
            <div className="mt-2.5 space-y-2.5">
              <div>
                <p className="label">Publishable key</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-paper px-2.5 py-1.5 font-mono text-[10.5px] text-ink">
                    {state.settings.publicKey}
                  </code>
                  <CopyButton value={state.settings.publicKey} label="" />
                </div>
              </div>
              <div>
                <p className="label">Webhook URL</p>
                <input
                  className="field mt-1 !py-2 font-mono !text-[11px]"
                  value={draft.webhookUrl}
                  onChange={(event) => setDraft({ ...draft, webhookUrl: event.target.value })}
                  aria-label="Webhook URL"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => rotateSecret("public")}
                  className="btn-ghost !px-2.5 !py-1.5 !text-[10.5px]"
                >
                  <Icon name="refresh" className="h-3 w-3" /> Rotate publishable key
                </button>
                <button
                  onClick={() => rotateSecret("webhook")}
                  className="btn-ghost !px-2.5 !py-1.5 !text-[10.5px]"
                >
                  <Icon name="refresh" className="h-3 w-3" /> Rotate webhook secret
                </button>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <p className="text-[12px] font-semibold text-ink">Demo controls</p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">
              Sessions and settings live in this browser&apos;s localStorage. Reset clears the ledger and restores
              the seeded six-day history.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {confirmReset ? (
                <>
                  <button
                    onClick={() => {
                      resetDemo();
                      setConfirmReset(false);
                    }}
                    className="btn !border-bad !bg-bad !py-1.5 !text-[11px] !text-white"
                  >
                    Yes, wipe the sandbox
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="text-[11px] text-ink-mute underline"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="btn-ghost !py-1.5 !text-[11px] !text-bad"
                >
                  <Icon name="refresh" className="h-3 w-3" /> Reset demo data
                </button>
              )}
              <span className="text-[10px] text-ink-mute">
                Seeded {new Date(state.seededAt).toLocaleDateString("en-IN")}
              </span>
            </div>
          </div>

          <Callout tone="danger" title="Never store real secrets in a client build">
            This page shows how configuration is surfaced to staff. In production, secrets live in the server
            environment, are encrypted at rest, and are never sent to the browser.
          </Callout>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-line px-4 py-2.5">
          <p className="text-[12px] font-semibold text-ink">Recent audit entries</p>
        </div>
        <ul className="divide-y divide-line">
          {state.audit.slice(0, 8).map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="text-[11px] text-ink-soft">
                <span className="font-mono text-[10px] text-ink">{entry.action}</span> — {entry.detail}
              </span>
              <span className="font-mono text-[9.5px] text-ink-mute">
                {entry.actor} · {new Date(entry.at).toLocaleTimeString("en-IN")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
