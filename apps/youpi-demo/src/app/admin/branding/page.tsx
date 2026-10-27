"use client";

import { useState } from "react";
import { Callout, Icon } from "@/components/ui";
import { cn, formatPaise, readableOn } from "@/lib/format";
import { useDemo } from "@/lib/store";

const palette = ["#0B5E4F", "#0C1116", "#1F3A93", "#7A2E4A", "#B5451B", "#4A4A8A", "#146B5C", "#8A6A16"];

export default function BrandingPage() {
  const { state, updateBranding } = useDemo();
  const [draft, setDraft] = useState(state.branding);

  const apply = () => updateBranding(draft);
  const fg = readableOn(draft.primaryColor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">White-label</p>
          <h1 className="mt-1 text-[22px] font-semibold leading-tight text-ink">Make the gateway yours</h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-mute">
            Buyers should see your brand, not a third-party logo. Name, colour, mark, support details and the
            guarantee line all come from settings — nothing is hardcoded.
          </p>
        </div>
        <button onClick={apply} className="btn-primary !py-2 !text-[11.5px]">
          <Icon name="check" className="h-3.5 w-3.5" /> Save branding
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* controls */}
        <div className="card space-y-4 p-4">
          <div>
            <label htmlFor="appName" className="label">
              App name
            </label>
            <input
              id="appName"
              className="field mt-1.5 !text-[12px]"
              value={draft.appName}
              onChange={(event) => setDraft({ ...draft, appName: event.target.value })}
            />
          </div>

          <div>
            <label htmlFor="tagline" className="label">
              Tagline
            </label>
            <input
              id="tagline"
              className="field mt-1.5 !text-[12px]"
              value={draft.tagline}
              onChange={(event) => setDraft({ ...draft, tagline: event.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="mark" className="label">
                Logo mark (2 letters)
              </label>
              <input
                id="mark"
                className="field mt-1.5 !text-[12px]"
                maxLength={2}
                value={draft.logoMark}
                onChange={(event) => setDraft({ ...draft, logoMark: event.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label htmlFor="color" className="label">
                Primary colour
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="color"
                  type="color"
                  value={draft.primaryColor}
                  onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-white p-1"
                />
                <input
                  className="field !py-2 font-mono !text-[11.5px]"
                  value={draft.primaryColor}
                  onChange={(event) => setDraft({ ...draft, primaryColor: event.target.value })}
                  aria-label="Primary colour hex"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="label">Preset palette</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {palette.map((color) => (
                <button
                  key={color}
                  onClick={() => setDraft({ ...draft, primaryColor: color })}
                  className={cn(
                    "h-7 w-7 rounded-lg border-2 transition",
                    draft.primaryColor.toLowerCase() === color.toLowerCase()
                      ? "border-ink"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Use ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="email" className="label">
                Support email
              </label>
              <input
                id="email"
                className="field mt-1.5 !text-[12px]"
                value={draft.supportEmail}
                onChange={(event) => setDraft({ ...draft, supportEmail: event.target.value })}
              />
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Support phone
              </label>
              <input
                id="phone"
                className="field mt-1.5 !text-[12px]"
                value={draft.supportPhone}
                onChange={(event) => setDraft({ ...draft, supportPhone: event.target.value })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="guarantee" className="label">
              Footer guarantee line
            </label>
            <input
              id="guarantee"
              className="field mt-1.5 !text-[12px]"
              value={draft.footerGuarantee}
              onChange={(event) => setDraft({ ...draft, footerGuarantee: event.target.value })}
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-xl border border-line bg-paper px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 accent-[#0B5E4F]"
              checked={draft.hidePoweredBy}
              onChange={(event) => setDraft({ ...draft, hidePoweredBy: event.target.checked })}
            />
            <span>
              <span className="block text-[11.5px] font-semibold text-ink">Hide “powered by” attribution</span>
              <span className="block text-[10.5px] text-ink-mute">
                Completely removes the platform badge from checkout, outcome pages and receipts.
              </span>
            </span>
          </label>
        </div>

        {/* preview */}
        <div className="space-y-3">
          <p className="label">Live preview</p>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ backgroundColor: draft.primaryColor, color: fg }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="grid h-7 w-7 place-items-center rounded-lg border text-[11px] font-bold"
                  style={{ borderColor: `${fg}44`, backgroundColor: `${fg}18`, color: fg }}
                >
                  {draft.logoMark || "YP"}
                </span>
                <div>
                  <p className="text-[12px] font-semibold leading-none">{draft.appName}</p>
                  <p className="mt-0.5 text-[10px] leading-none opacity-70">{draft.tagline}</p>
                </div>
              </div>
              <span className="rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase" style={{ borderColor: `${fg}44` }}>
                secure
              </span>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-[auto_1fr]">
              <div className="grid h-[132px] w-[132px] place-items-center rounded-xl border border-line bg-paper-deep">
                <Icon name="qr" className="h-10 w-10 text-ink/70" />
              </div>
              <div>
                <p className="label">Amount to pay</p>
                <p className="mono-nums mt-1 text-[24px] font-semibold leading-none text-ink">
                  {formatPaise(4900)}
                </p>
                <p className="mt-1.5 text-[10.5px] text-ink-mute">Demo merchant · order YP-1041</p>
                <button
                  className="mt-3 w-full rounded-full px-3 py-2 text-[12px] font-semibold"
                  style={{ backgroundColor: draft.primaryColor, color: fg }}
                >
                  I have paid — check my payment
                </button>
                <p className="mt-2 text-[9.5px] leading-relaxed text-ink-mute">{draft.footerGuarantee}</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line bg-paper px-4 py-2 text-[9.5px] text-ink-mute">
              <span>
                {draft.supportEmail} · {draft.supportPhone}
              </span>
              <span>{draft.hidePoweredBy ? "" : "powered by YouPI"}</span>
            </div>
          </div>

          <Callout tone="info" title="Contrast is checked for you">
            Button and header text flips between ink and white automatically so every palette stays readable — the
            same rule the real checkout applies before rendering.
          </Callout>

          <div className="card p-4">
            <p className="label">Where this is used</p>
            <ul className="mt-2 space-y-1.5 text-[11px] text-ink-soft">
              {[
                "Checkout header, buttons and footer",
                "All five outcome pages",
                "Receipts, invoices and WhatsApp messages",
                "Webhook payload metadata (merchant label)",
              ].map((item) => (
                <li key={item} className="flex gap-1.5">
                  <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-ok" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
