"use client";

import Link from "next/link";
import { useState } from "react";
import { HeroDemoCard } from "@/components/HeroDemoCard";
import { CodeBlock, Eyebrow, Icon, LinkCard, SectionHeading, StatusPill, Tabs } from "@/components/ui";
import { demoScenario, featureMatrix } from "@/lib/config";
import { formatPaise } from "@/lib/format";
import { selectors, useDemo } from "@/lib/store";

const snippets = {
  script: `<script src="https://pay.youpi.demo/youpi.js"
        data-youpi-key="ypk_live_9f2b71c4e8a05d36"></script>

<button data-youpi-pay
        data-order-id="YP-1041"
        data-amount="499.00"
        data-name="Demo Store">
  Pay ₹499
</button>`,
  sdk: `Youpi.pay({
  order_id: "YP-1041",
  amount: 499.0,
  customer: { name: "Ananya", phone: "9876543210" },
  metadata: { sku: "KURTA-M" },
  handler: (res) => {
    // UI only — fulfilment waits for the webhook
    console.log(res.status, res.utr);
  },
});`,
  webhook: `// Node/Express — raw body, constant-time compare
app.post("/api/youpi-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const expected = "sha256=" + crypto
      .createHmac("sha256", process.env.YOUPI_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    if (!safeEqual(expected, req.headers["x-gateway-signature"]))
      return res.status(401).end();

    res.status(200).end();        // ack first
    queue.add("fulfil", req.body); // then work
  });`,
};

export default function HomePage() {
  const { state, now } = useDemo();
  const stats = selectors.stats(state);
  const [snippet, setSnippet] = useState<keyof typeof snippets>("script");
  const queue = selectors.queue(state);

  const successRate =
    stats.total === 0
      ? 0
      : Math.round(
          (state.sessions.filter((s) => s.status === "SUCCESS" || s.status === "REFUNDED").length /
            stats.total) *
            100,
        );

  return (
    <div>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="mx-auto grid w-full max-w-[1180px] items-center gap-10 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-ink/15 bg-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-ok" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-ok" />
                </span>
                Working demo · every screen is clickable
              </span>
              <span className="chip">
                <Icon name="qr" className="h-3.5 w-3.5" /> UPI-first
              </span>
              <span className="chip">
                <Icon name="chat" className="h-3.5 w-3.5" /> WhatsApp OTP
              </span>
            </div>

            <h1 className="mt-5 text-[34px] font-semibold leading-[1.05] tracking-tight text-ink sm:text-[54px]">
              UPI payments into your
              <span className="relative mx-2 inline-block">
                <span className="relative z-10">own</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-3 bg-accent/45" aria-hidden />
              </span>
              bank account.
              <br />
              See the whole flow, live.
            </h1>

            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-ink-mute sm:text-[15.5px]">
              This is a fully interactive demo of a self-hosted YouPI gateway: WhatsApp-verified checkout, a
              single-use UPI QR, a single-slot payment queue, bank-observer verification and signed webhooks.
              Click anything — a sandbox ledger fills up as you go.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link href="/store" className="btn-primary">
                Start at the demo store
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link href="/checkout" className="btn-ghost">
                Open checkout directly
              </Link>
              <Link href="/docs" className="btn-ghost">
                <Icon name="book" className="h-3.5 w-3.5" />
                Integration docs
              </Link>
            </div>

            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-3">
              {[
                { k: "Payments in ledger", v: String(stats.total) },
                { k: "Success rate", v: `${successRate}%` },
                { k: "Live slot", v: stats.active > 0 ? `${stats.active} in use` : "free" },
              ].map((item) => (
                <div key={item.k} className="border-l-2 border-line pl-3">
                  <dd className="mono-nums text-[19px] font-semibold leading-none text-ink">{item.v}</dd>
                  <dt className="mt-1 text-[10.5px] uppercase tracking-[0.09em] text-ink-mute">{item.k}</dt>
                </div>
              ))}
            </dl>
          </div>

          <HeroDemoCard />
        </div>
      </section>

      {/* --------------------------------------------------- trust strip */}
      <section className="border-b border-line bg-white/60">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          {[
            { icon: "lock", text: "Server decides every amount" },
            { icon: "clock", text: "Timers survive refresh & restart" },
            { icon: "queue", text: "One active UPI slot at a time" },
            { icon: "shield", text: "HMAC-SHA256 signed webhooks" },
            { icon: "layers", text: "Audit log on every change" },
          ].map((item) => (
            <span key={item.text} className="flex items-center gap-2 text-[11.5px] font-medium text-ink-soft">
              <Icon name={item.icon} className="h-4 w-4 text-brand" />
              {item.text}
            </span>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------- scenario */}
      <section className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="The demo path"
            title="Six clicks, the entire payment lifecycle"
            copy="Every step below is a real screen in this build — not a screenshot. Follow them in order, or jump straight to the part your client cares about."
          />
          <Link href="/demo-pack" className="btn-ghost shrink-0">
            <Icon name="wallet" className="h-4 w-4" />
            One-click demo pack
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {demoScenario.map((step) => (
            <Link
              key={step.step}
              href={step.href}
              className="group card flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-ledger"
            >
              <div className="flex items-center justify-between">
                <span className="mono-nums text-[11px] font-bold tracking-[0.12em] text-ink-mute">{step.step}</span>
                <Icon
                  name="arrowUpRight"
                  className="h-4 w-4 text-line-strong transition group-hover:text-brand"
                />
              </div>
              <p className="mt-3 text-[15px] font-semibold leading-snug text-ink">{step.title}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-mute">{step.detail}</p>
              <span className="mt-auto pt-4 text-[12px] font-semibold text-brand">{step.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- flow */}
      <section className="border-y border-line bg-ink text-white">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Architecture</p>
          <h2 className="mt-2 max-w-2xl text-[26px] font-semibold leading-tight sm:text-[32px]">
            Money never asks the browser for permission
          </h2>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-white/60">
            The buyer sees a QR. The gateway sees a session. Your server only ever trusts a signed observation —
            which is why a closed tab, a refresh or a spoofed redirect can never mark an order paid.
          </p>

          <div className="mt-9 grid gap-3 md:grid-cols-5">
            {[
              {
                t: "Merchant store",
                d: "Order id + amount. Nothing else is trusted.",
                icon: "bank",
                tag: "client",
              },
              {
                t: "YouPI checkout",
                d: "WhatsApp OTP, single-use QR, dual timers.",
                icon: "chat",
                tag: "hosted",
              },
              {
                t: "UPI rails",
                d: "Buyer pays into the merchant's own VPA.",
                icon: "wallet",
                tag: "network",
              },
              {
                t: "Observer mesh",
                d: "Android APK, Gmail, Messages → signed events.",
                icon: "signal",
                tag: "verify",
              },
              {
                t: "Your webhook",
                d: "HMAC-verified, idempotent, queued work.",
                icon: "webhook",
                tag: "server",
              },
            ].map((node, i) => (
              <div key={node.t} className="relative rounded-xl border border-white/12 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <Icon name={node.icon} className="h-4 w-4 text-accent" />
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-white/35">
                    {node.tag}
                  </span>
                </div>
                <p className="mt-3 text-[13px] font-semibold">{node.t}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-white/50">{node.d}</p>
                {i < 4 && (
                  <span className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white/60 md:grid">
                    <Icon name="arrow" className="h-3 w-3" />
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 font-mono text-[11px] text-white/45">
            <span>amount_paise: 49900</span>
            <span>·</span>
            <span>status: SUCCESS ⇐ observer match</span>
            <span>·</span>
            <span>signature: sha256=&lt;64 hex&gt;</span>
            <span>·</span>
            <span>idempotency: delivery-id dedupe</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- features */}
      <section className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8">
        <SectionHeading
          eyebrow="Everything is wired"
          title="Eight systems you can inspect, not just read about"
          copy="Each card below maps to a screen in the admin console or the checkout flow. Open them side by side while you present."
        />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {featureMatrix.map((feature) => (
            <div key={feature.title} className="card flex flex-col p-5">
              <span className="chip w-fit !text-[10px] uppercase tracking-[0.1em]">{feature.tag}</span>
              <p className="mt-3 text-[14px] font-semibold leading-snug text-ink">{feature.title}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- screens */}
      <section className="border-y border-line bg-white/50">
        <div className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionHeading
                eyebrow="Walk the build"
                title="Open all five surfaces in five tabs"
                copy="The demo is a single app so nothing breaks during a demo call: storefront, checkout, outcome pages, admin console and docs all share one sandbox ledger."
              />
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5">
                  <span className="text-[12px] text-ink-mute">Payments recorded</span>
                  <span className="mono-nums text-[13px] font-semibold text-ink">{stats.total}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5">
                  <span className="text-[12px] text-ink-mute">Verified volume (demo)</span>
                  <span className="mono-nums text-[13px] font-semibold text-ok">{formatPaise(stats.volume)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5">
                  <span className="text-[12px] text-ink-mute">Currently queued</span>
                  <span className="mono-nums text-[13px] font-semibold text-ink">
                    {queue.length === 0 ? "empty" : `${queue.length} waiting`}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3.5 py-2.5">
                  <span className="text-[12px] text-ink-mute">Observer heartbeats</span>
                  <span className="flex items-center gap-1.5">
                    {state.observers.map((o) => (
                      <StatusPill key={o.channel} status={o.status} />
                    ))}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <LinkCard
                href="/store"
                eyebrow="Surface 01"
                title="Merchant storefront"
                copy="A real product page with cart, size picker, coupon field and a YouPI pay button."
                cta="Open store"
              />
              <LinkCard
                href="/checkout"
                eyebrow="Surface 02"
                title="Checkout + QR"
                copy="WhatsApp OTP gate, dynamic QR, dual timers, queue position and live polling."
                cta="Open checkout"
              />
              <LinkCard
                href="/outcomes"
                eyebrow="Surface 03"
                title="Five outcome pages"
                copy="Success, failed, suspicious, expired and cancelled — each with the right next action."
                cta="Open outcomes"
              />
              <LinkCard
                href="/admin"
                eyebrow="Surface 04"
                title="Admin console"
                copy="Payments ledger, live queue, observer mesh, branding, webhooks and security."
                cta="Open admin"
              />
              <LinkCard
                href="/docs"
                eyebrow="Surface 05"
                title="Integration docs"
                copy="Script tag, SDK, webhook verification, error codes and the go-live checklist."
                cta="Open docs"
              />
              <LinkCard
                href="/demo-pack"
                eyebrow="Shortcut"
                title="Demo pack"
                copy="Pre-seeded scenarios for a 5-minute client walkthrough, one click each."
                cta="Open demo pack"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- integration */}
      <section className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <Eyebrow>Integration</Eyebrow>
            <h2 className="mt-2 text-[26px] font-semibold leading-tight sm:text-[30px]">
              Three snippets and you are live
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-mute">
              Drop-in script for a static site, a programmatic call for React or Next.js, and a webhook handler
              for your backend. The docs page has copy-paste versions with your sandbox keys.
            </p>
            <ul className="mt-5 space-y-2.5">
              {[
                "Declarative buttons — no JavaScript needed",
                "Browser events for UX only; server webhook for truth",
                "Amounts in integer paise end to end",
                "Idempotency-Key prevents duplicate sessions",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12.5px] text-ink-soft">
                  <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/docs" className="btn-primary mt-6">
              Read the integration guide
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>

          <div>
            <Tabs
              tabs={[
                { id: "script", label: "Script tag" },
                { id: "sdk", label: "Programmatic" },
                { id: "webhook", label: "Webhook" },
              ]}
              value={snippet}
              onChange={(id) => setSnippet(id as keyof typeof snippets)}
            />
            <div className="mt-3">
              <CodeBlock
                code={snippets[snippet]}
                language={snippet === "webhook" ? "javascript" : snippet === "sdk" ? "javascript" : "html"}
                filename={
                  snippet === "webhook" ? "api/youpi-webhook.ts" : snippet === "sdk" ? "checkout.tsx" : "index.html"
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- cta */}
      <section className="mx-auto w-full max-w-[1180px] px-5 pb-4 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-ink bg-ink px-6 py-10 text-white sm:px-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-brand/40 blur-2xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Ready for the client call?
              </p>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight sm:text-[30px]">
                Run the 5-minute demo script, end to end.
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-white/60">
                Store → checkout → QR → observer → webhook → admin ledger. Every click is live and no real
                money ever moves.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/demo-pack" className="btn-accent">
                <Icon name="layers" className="h-4 w-4" />
                Start the demo pack
              </Link>
              <Link
                href="/admin"
                className="btn border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                Open admin console
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
