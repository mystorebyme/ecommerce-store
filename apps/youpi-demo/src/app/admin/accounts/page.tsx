"use client";

import { useState } from "react";
import { Callout, CopyButton, Icon, StatusPill } from "@/components/ui";
import { cn } from "@/lib/format";
import { useDemo } from "@/lib/store";

export default function AccountsPage() {
  const { state, updateSettings } = useDemo();
  const [newVpa, setNewVpa] = useState("");
  const [label, setLabel] = useState("");
  const [registered, setRegistered] = useState<{ vpa: string; label: string; active: boolean }[]>([
    { vpa: state.settings.vpa, label: "Primary current account", active: true },
    { vpa: "youpi.alt@axisbank", label: "Backup handle (rotation)", active: false },
  ]);

  const activate = (vpa: string) => {
    updateSettings({ vpa });
    setRegistered((prev) => prev.map((account) => ({ ...account, active: account.vpa === vpa })));
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="label">UPI accounts</p>
        <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">Receiving handles &amp; rotation</h1>
        <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-mute">
          One handle holds the active slot at a time. Rotating to a second handle lets you keep accepting payments
          while a bank statement is being reconciled.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <p className="text-[12px] font-semibold text-ink">Registered handles</p>
          </div>
          <ul className="divide-y divide-line">
            {registered.map((account) => (
              <li key={account.vpa} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-mono text-[12px] font-semibold text-ink">{account.vpa}</p>
                  <p className="mt-0.5 text-[10.5px] text-ink-mute">{account.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  {account.active ? (
                    <StatusPill status="online" />
                  ) : (
                    <button
                      onClick={() => activate(account.vpa)}
                      className="rounded-lg border border-line bg-white px-2.5 py-1 text-[10.5px] font-semibold text-ink-soft hover:text-ink"
                    >
                      Activate
                    </button>
                  )}
                  <CopyButton value={account.vpa} label="Copy VPA" />
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t border-line bg-paper px-4 py-3">
            <p className="label">Add a handle</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className="field !py-2 !text-[12px]"
                placeholder="store.vpa@bank"
                value={newVpa}
                onChange={(event) => setNewVpa(event.target.value.trim())}
                aria-label="New UPI VPA"
              />
              <input
                className="field !py-2 !text-[12px]"
                placeholder="Label (e.g. savings account)"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                aria-label="Account label"
              />
              <button
                onClick={() => {
                  if (!newVpa.includes("@")) return;
                  setRegistered((prev) => [
                    ...prev,
                    { vpa: newVpa, label: label || "New handle", active: false },
                  ]);
                  setNewVpa("");
                  setLabel("");
                }}
                className="btn-primary !py-2 !text-[11.5px]"
              >
                Add
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-ink-mute">
              Demo only — no verification call is made to the bank or PSP.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="card p-4">
            <p className="label">Active handle</p>
            <p className="mt-1 font-mono text-[14px] font-semibold text-ink">{state.settings.vpa}</p>
            <div className="mt-3 grid gap-2 text-[11px]">
              {[
                ["Merchant name", state.settings.merchantName],
                ["Settlement", "direct P2P to this account"],
                ["Slot policy", "exactly one active payment"],
                ["Currency", "INR · integer paise"],
              ].map(([key, value]) => (
                <div key={key} className="flex items-center justify-between border-b border-line/70 pb-1.5">
                  <span className="text-ink-mute">{key}</span>
                  <span className="text-right text-ink-soft">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <Callout tone="warn" title="Bank-side rules still apply">
            Self-hosted collection does not remove your bank&apos;s and UPI&apos;s limits. Keep volumes modest,
            reconcile daily, and confirm the intended business use with your bank before taking real money.
          </Callout>

          <div className="card p-4">
            <p className="label">Test the handle</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-mute">
              Rendering a QR for ₹1 on the active handle is the quickest end-to-end sanity check before a client
              demo.
            </p>
            <a href="/checkout" className="btn-ghost mt-2.5 w-full !text-[11.5px]">
              <Icon name="qr" className="h-3.5 w-3.5" /> Open checkout
            </a>
          </div>
        </div>
      </div>

      <div className={cn("card p-4")}>
        <p className="label">Rotation plan (recommended)</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[
            { t: "Before rotation", d: "Drain the queue, let the active slot finish, export the ledger." },
            { t: "During rotation", d: "Activate the new handle, run a ₹1 test, confirm an observation lands." },
            { t: "After rotation", d: "Reconcile both statements, archive the old QR assets, rotate webhook secret." },
          ].map((step, i) => (
            <div key={step.t} className="rounded-xl border border-line bg-paper p-3">
              <p className="mono-nums text-[10px] font-bold text-ink-mute">0{i + 1}</p>
              <p className="mt-1 text-[11.5px] font-semibold text-ink">{step.t}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-mute">{step.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
