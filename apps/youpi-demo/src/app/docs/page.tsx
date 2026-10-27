"use client";

import Link from "next/link";
import { useState } from "react";
import { Callout, CodeBlock, Icon, PageIntro } from "@/components/ui";
import { cn } from "@/lib/format";

const toc = [
  { id: "overview", label: "01 · What this is" },
  { id: "architecture", label: "02 · How it fits together" },
  { id: "quickstart", label: "03 · Quickstart" },
  { id: "lifecycle", label: "04 · Payment lifecycle" },
  { id: "api", label: "05 · API reference" },
  { id: "sdk", label: "06 · SDK & buttons" },
  { id: "webhooks", label: "07 · Webhooks" },
  { id: "errors", label: "08 · Error codes" },
  { id: "testing", label: "09 · Testing the flow" },
  { id: "security", label: "10 · Security & compliance" },
  { id: "deploy", label: "11 · Deploy on Vercel" },
  { id: "checklist", label: "12 · Go-live checklist" },
  { id: "faq", label: "13 · FAQ" },
];

function Section({
  id,
  title,
  eyebrow,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-line pt-8">
      <p className="label">{eyebrow}</p>
      <h2 className="mt-1.5 text-[22px] font-semibold leading-tight text-ink sm:text-[26px]">{title}</h2>
      <div className="mt-4 space-y-3.5 text-[13px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-left text-[11.5px]">
        <thead>
          <tr className="border-b border-line bg-paper text-[9.5px] uppercase tracking-[0.1em] text-ink-mute">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className={cn("px-3 py-2 align-top", j === 0 && "font-mono text-[10.5px] text-ink")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState("overview");

  return (
    <>
      <PageIntro
        eyebrow="Documentation"
        title="Integrate YouPI, step by step"
        copy="Everything an engineer needs to take this demo to a working staging environment: the API contract, the SDK surface, webhook verification in four languages, error codes, deployment and a go-live checklist."
      >
        <span className="chip">
          <Icon name="book" className="h-3.5 w-3.5" /> v2 · API /api/v1
        </span>
        <span className="chip">
          <Icon name="lock" className="h-3.5 w-3.5" /> HMAC-SHA256
        </span>
        <span className="chip">
          <Icon name="wallet" className="h-3.5 w-3.5" /> amounts in paise
        </span>
      </PageIntro>

      <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-9 sm:px-8 lg:grid-cols-[210px_1fr]">
        <nav aria-label="Documentation contents" className="hidden lg:block">
          <div className="sticky top-20">
            <p className="label">Contents</p>
            <ul className="mt-2 space-y-0.5">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={() => setActive(item.id)}
                    className={cn(
                      "block rounded-lg px-2.5 py-1.5 text-[11.5px] transition",
                      active === item.id
                        ? "bg-ink font-semibold text-white"
                        : "text-ink-soft hover:bg-paper-deep",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-xl border border-line bg-white p-3">
              <p className="label">Sandbox keys</p>
              <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-ink-mute">
                ypk_live_9f2b71c4e8a05d36
                <br />
                whsec_demo_6b1f9c27aa4e5d908b3c
              </p>
              <Link href="/admin/settings" className="mt-2 inline-block text-[10.5px] font-semibold text-brand">
                Manage in admin →
              </Link>
            </div>
          </div>
        </nav>

        <div className="min-w-0 space-y-8">
          <Section id="overview" eyebrow="01 · What this is" title="A self-hosted UPI gateway, demonstrated honestly">
            <p>
              YouPI accepts UPI payments into a merchant&apos;s own UPI handle. There is no aggregator in the middle:
              the buyer scans a single-use QR built by the gateway, the money lands in the merchant&apos;s bank
              account, and the gateway confirms the credit from bank observations (SMS, notifications, email).
            </p>
            <p>
              This site is a <strong>demo</strong>. It reproduces the product surface — checkout, queue, observers,
              admin, webhooks — with an in-browser state machine so you can present the whole flow without a bank
              account. No money moves, and the QR encodes a sandbox VPA on purpose.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                { t: "Server-authoritative", d: "Amounts, timers and status live on the server." },
                { t: "Deterministic", d: "Exact amount matching + one active slot per handle." },
                { t: "White-label", d: "Your name, colour and copy on every buyer-facing screen." },
              ].map((card) => (
                <div key={card.t} className="rounded-xl border border-line bg-white p-3">
                  <p className="text-[11.5px] font-semibold text-ink">{card.t}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-mute">{card.d}</p>
                </div>
              ))}
            </div>
            <Callout tone="warn" title="Before real money">
              A self-hosted collection setup is not a licensed payment aggregator. Confirm the intended use with
              your bank, keep volumes modest, reconcile daily, and get independent review of the code and the
              compliance position.
            </Callout>
          </Section>

          <Section id="architecture" eyebrow="02 · How it fits together" title="Five services, one contract">
            <Table
              head={["Component", "Responsibility", "Runs on"]}
              rows={[
                ["payment-api", "Sessions, QR, queue, attribution, webhooks", "Node service (or Vercel function)"],
                ["checkout portal", "Buyer UI in an iframe or modal", "Static/SSR app"],
                ["merchant admin", "Catalog-free operations: payments, queue, settings", "Separate subdomain"],
                ["observers", "Android APK, Gmail, Messages → normalised events", "Device / worker"],
                ["your backend", "Verifies webhooks, fulfils orders", "Your stack"],
              ]}
            />
            <CodeBlock
              filename="request flow"
              language="text"
              code={`merchant store  ──POST /api/v1/payments──▶  payment-api
       │                                      │
       │◀──────── checkout_url ───────────────┘
       ▼
checkout portal ── WhatsApp OTP ──▶ verified buyer
       │
       ├── GET /api/v1/payments/:id/qr  (vector QR, single-use)
       └── SSE / poll /api/v1/payments/:id  (status)
                                          │
       bank credit ──▶ observer ──signed──▶ attribution match
                                          │
                              webhook (HMAC) ──▶ your backend ──▶ fulfil`}
            />
          </Section>

          <Section id="quickstart" eyebrow="03 · Quickstart" title="Four steps from zero to a paid demo order">
            <ol className="space-y-3">
              {[
                {
                  t: "Create a merchant + handle",
                  d: "Register the store, add the UPI handle, generate the publishable key and the webhook secret. In this demo it is pre-seeded — copy the keys from the admin settings page.",
                },
                {
                  t: "Create a payment session on your server",
                  d: "Your backend calls POST /api/v1/payments with an order id and an integer amount. Never create sessions from the browser with a price the buyer can edit.",
                },
                {
                  t: "Open the checkout",
                  d: "Either redirect to the returned checkout_url, or use the SDK to open the modal. The buyer verifies via WhatsApp OTP and pays the QR.",
                },
                {
                  t: "Fulfil on the webhook",
                  d: "Verify the HMAC over the raw body, dedupe on the delivery id, then mark the order paid and queue fulfilment.",
                },
              ].map((step, i) => (
                <li key={step.t} className="flex gap-3">
                  <span className="mono-nums grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[12.5px] font-semibold text-ink">{step.t}</span>
                    <span className="block text-[12px] leading-relaxed text-ink-mute">{step.d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <CodeBlock
              filename="server.ts"
              language="typescript"
              code={`const res = await fetch("https://pay.youpi.demo/api/v1/payments", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Merchant-Key": process.env.YOUPI_KEY!,
    "Idempotency-Key": \`order-\${order.id}\`,
  },
  body: JSON.stringify({
    order_id: order.reference,
    amount_paise: order.totalPaise,     // integer, never a float
    customer: { phone: order.phone },
    metadata: { cart_id: order.id },
  }),
});

const { checkout_url, payment_id } = await res.json();
return redirect(checkout_url);`}
            />
          </Section>

          <Section id="lifecycle" eyebrow="04 · Payment lifecycle" title="States, timers and who can change them">
            <Table
              head={["State", "Meaning", "Exit"]}
              rows={[
                ["QUEUED", "Waiting for the single active slot", "ACTIVE on promotion, CANCELLED by buyer"],
                ["ACTIVE", "QR rendered, 5:00 payment window running", "PROCESSING / EXPIRED / CANCELLED"],
                ["PROCESSING", "Buyer pressed verify, 0:30 observer window", "SUCCESS / FAILED"],
                ["SUCCESS", "Exact amount + UTR matched, webhook queued", "REFUNDED by staff"],
                ["FAILED", "No match inside the verify window", "terminal (buyer may retry)"],
                ["EXPIRED", "Payment window elapsed", "terminal"],
                ["CANCELLED", "Buyer closed checkout", "terminal"],
                ["SUSPICIOUS", "Held by fraud heuristics", "manual confirm or fail"],
                ["REFUNDED", "Refund recorded through payments module", "terminal"],
              ]}
            />
            <p>
              Only the server transitions a session. Browser events exist to update the UI — they carry no authority.
              Both timers are stored as absolute timestamps, so a refresh, a closed tab or a restart cannot extend
              or shorten a window.
            </p>
          </Section>

          <Section id="api" eyebrow="05 · API reference" title="Four endpoints cover the whole integration">
            <CodeBlock
              filename="POST /api/v1/payments"
              language="http"
              code={`POST /api/v1/payments
X-Merchant-Key: ypk_live_...
Idempotency-Key: order-1041
Content-Type: application/json

{
  "order_id": "YP-1041",
  "amount_paise": 49900,
  "currency": "INR",
  "customer": { "name": "Ananya", "phone": "9876543210" },
  "metadata": { "sku": "KURTA-M" },
  "success_url": "https://shop.example/order/success",
  "failed_url": "https://shop.example/order/failed"
}

201 Created
{
  "payment_id": "pay_8f21c7a4d3e1",
  "checkout_url": "https://pay.youpi.demo/checkout/pay_8f21c7a4d3e1",
  "qr_svg_url": "https://pay.youpi.demo/api/v1/payments/pay_8f21c7a4d3e1/qr.svg",
  "status": "ACTIVE",
  "pay_expires_at": 1761643422110,
  "verify_window_seconds": 30
}`}
            />
            <Table
              head={["Endpoint", "Purpose", "Notes"]}
              rows={[
                ["POST /payments", "Create session", "Idempotent on the header; amount re-validated"],
                ["GET /payments/:id", "Poll status", "Safe for short polling; cheap payload"],
                ["GET /payments/:id/qr", "Vector QR (SVG)", "Single-use, fixed amount, never cached publicly"],
                ["POST /payments/:id/cancel", "Buyer abandons", "Frees the slot immediately"],
                ["POST /refunds", "Staff-initiated refund", "Owner/manager role, audited, webhook emitted"],
              ]}
            />
            <Callout tone="info" title="Amounts are integers">
              Every amount field ends in <span className="font-mono">_paise</span>: ₹499.00 is{" "}
              <span className="font-mono">49900</span>. Rupees exist only for display. Reject any float you receive.
            </Callout>
          </Section>

          <Section id="sdk" eyebrow="06 · SDK & buttons" title="One script, or a typed call">
            <CodeBlock
              filename="index.html"
              language="html"
              code={`<script src="https://pay.youpi.demo/youpi.js"
        data-youpi-key="ypk_live_9f2b71c4e8a05d36"></script>

<button data-youpi-pay
        data-order-id="YP-1041"
        data-amount="499.00"
        data-name="Demo Store"
        data-success-url="/order/success">
  Pay ₹499
</button>`}
            />
            <CodeBlock
              filename="checkout.tsx"
              language="tsx"
              code={`"use client";
import { useEffect } from "react";

export function PayButton({ orderId, amountPaise }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://pay.youpi.demo/youpi.js";
    script.dataset.youpiKey = process.env.NEXT_PUBLIC_YOUPI_KEY!;
    document.head.appendChild(script);
  }, []);

  return (
    <button
      data-youpi-pay
      data-order-id={orderId}
      data-amount={(amountPaise / 100).toFixed(2)}
    >
      Pay now
    </button>
  );
}`}
            />
            <Table
              head={["Option / event", "Type", "Purpose"]}
              rows={[
                ["order_id", "string", "Your order reference (required in production)"],
                ["amount", "string", "Rupees for display only; server re-validates"],
                ["customer.phone", "string", "WhatsApp OTP target"],
                ["metadata", "object", "Echoed back in webhooks"],
                ["handler(res)", "callback", "UI success — not authority"],
                ["onFailed / onClose", "callback", "UI states for failed and cancelled"],
                ["youpi:payment:success", "DOM event", "Use for analytics and toast messages"],
              ]}
            />
          </Section>

          <Section id="webhooks" eyebrow="07 · Webhooks" title="Verify raw bytes, then dedupe">
            <p>
              One delivery per terminal event. Headers:{" "}
              <span className="font-mono text-[11.5px]">X-Gateway-Signature</span>,{" "}
              <span className="font-mono text-[11.5px]">X-Gateway-Delivery-Id</span>,{" "}
              <span className="font-mono text-[11.5px]">X-Gateway-Timestamp</span>,{" "}
              <span className="font-mono text-[11.5px]">X-Gateway-Event</span>.
            </p>
            <CodeBlock
              filename="payload.json"
              language="json"
              code={`{
  "event": "SUCCESS",
  "paymentId": "pay_8f21c7a4d3e1",
  "orderId": "YP-1041",
  "amount": "499.00",
  "amountPaise": 49900,
  "currency": "INR",
  "method": "UPI",
  "utr": "412345678901",
  "completedAt": "2026-10-27T09:12:04.000Z",
  "deliveryId": "dlv_2c9f81a4b7",
  "timestamp": 1761643324000,
  "verificationLevel": "observer-signal",
  "metadata": { "sku": "KURTA-M" }
}`}
            />
            <div className="grid gap-3">
              <CodeBlock
                filename="node-express.ts"
                language="typescript"
                code={`app.post("/api/youpi-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const expected = "sha256=" + crypto
      .createHmac("sha256", process.env.YOUPI_WEBHOOK_SECRET)
      .update(req.body)
      .digest("hex");

    const received = req.headers["x-gateway-signature"] ?? "";
    const ok = received.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));

    if (!ok) return res.status(401).json({ error: "bad signature" });

    const event = JSON.parse(req.body.toString());

    // idempotent: unique index on deliveryId
    if (!(await markDelivered(event.deliveryId))) {
      return res.status(200).json({ duplicate: true });
    }

    res.status(200).json({ ok: true });          // ack fast
    await fulfilmentQueue.add("paid", event);    // work after
  });`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <CodeBlock
                  filename="python-fastapi.py"
                  language="python"
                  maxHeight={220}
                  code={`import hmac, hashlib, json
from fastapi import Request, HTTPException

@app.post("/api/youpi-webhook")
async def hook(request: Request):
    raw = await request.body()
    expected = "sha256=" + hmac.new(
        SECRET.encode(), raw, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(
        expected, request.headers.get("x-gateway-signature", "")
    ):
        raise HTTPException(401)
    return {"ok": True}`}
                />
                <CodeBlock
                  filename="php-laravel.php"
                  language="php"
                  maxHeight={220}
                  code={`$raw = $request->getContent();
$expected = 'sha256=' . hash_hmac(
    'sha256', $raw, env('YOUPI_WEBHOOK_SECRET')
);
if (!hash_equals($expected,
    $request->header('X-Gateway-Signature', ''))) {
    abort(401);
}
$event = json_decode($raw, true);`}
                />
              </div>
            </div>
            <Table
              head={["Rule", "Why"]}
              rows={[
                ["Compute over the raw body", "Any reserialize changes bytes and breaks the HMAC"],
                ["Constant-time compare", "Prevents timing side channels"],
                ["Dedupe on deliveryId", "Retries resend the same body and timestamp"],
                ["Ack 2xx, then work", "Slow handlers cause retries and duplicate effort"],
                ["Re-check amount + order state", "A valid signature is not proof of settlement"],
              ]}
            />
          </Section>

          <Section id="errors" eyebrow="08 · Error codes" title="What to show the buyer, what to log">
            <Table
              head={["Code", "HTTP", "Meaning / action"]}
              rows={[
                ["ORDER_AMOUNT_MISMATCH", "409", "Order id reused with a different amount — create a new order"],
                ["IDEMPOTENCY_CONFLICT", "409", "Same key, different payload — fix the client retry"],
                ["SESSION_ALREADY_FINAL", "409", "Session is already SUCCESS/FAILED — poll instead"],
                ["QR_EXPIRED", "410", "Payment window elapsed — create a new session"],
                ["OBSERVER_TIMEOUT", "422", "No observation inside the verify window — retry"],
                ["FRAUD_HELD", "423", "Held for review — do not retry automatically"],
                ["INVALID_SIGNATURE", "401", "Webhook signature failed — reject"],
                ["RATE_LIMITED", "429", "Back off with jitter; 20 req/min per merchant default"],
              ]}
            />
          </Section>

          <Section id="testing" eyebrow="09 · Testing the flow" title="Seven scenarios worth rehearsing">
            <Table
              head={["Scenario", "How to reproduce", "Expected"]}
              rows={[
                ["Happy path", "Demo pack → happy path", "SUCCESS + signed webhook"],
                ["Amount mismatch", "Demo pack → mismatch", "FAILED, no auto-credit"],
                ["No observation", "Demo pack → timeout", "FAILED after 0:30"],
                ["Queue", "Demo pack → fill queue", "One ACTIVE, two QUEUED, auto-promote"],
                ["Expiry", "Leave a QR open 5:00", "EXPIRED, slot released"],
                ["Duplicate webhook", "Re-send the same delivery id", "Second call is a no-op"],
                ["Tampered body", "Admin → Webhooks → tamper", "Verification fails, 401"],
              ]}
            />
            <Callout tone="info" title="Test like a payment engineer">
              Before go-live, replay every webhook twice, kill the tab mid-payment, restart the API during
              verification, and confirm the ledger still reconciles to the bank statement.
            </Callout>
          </Section>

          <Section id="security" eyebrow="10 · Security & compliance" title="The non-negotiables">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                ["Amounts", "Integer paise everywhere; server recomputes on every read."],
                ["Signatures", "Raw-body HMAC, constant-time compare, timestamp freshness."],
                ["Secrets", "Server-side only. Rotate webhook secret every 90 days."],
                ["Authorisation", "RBAC enforced in the API, not the UI; audit every staff action."],
                ["PII", "Mask phone/email for support; explicit consent at checkout (DPDP)."],
                ["Retention", "Invoices 8 years (GST), PII 24 months unless a legal hold applies."],
                ["Uploads", "Presigned URLs — images never pass through the API."],
                ["Rate limits", "Per merchant, per IP, per phone number, with jittered retries."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-line bg-white p-3">
                  <p className="text-[11.5px] font-semibold text-ink">{t}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-mute">{d}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="deploy" eyebrow="11 · Deployment" title="Ship the demo on Vercel in one command">
            <p>
              This demo app is a fully static Next.js export, which means it deploys to Vercel&apos;s free tier with
              no server, no database and no environment variables.
            </p>
            <CodeBlock
              filename="terminal"
              language="bash"
              code={`# 1. from the repo root
cd apps/youpi-demo
npm install

# 2. build the static export (outputs ./out)
npm run build

# 3. deploy with the Vercel CLI
npx vercel --prod
#    Framework preset : Next.js
#    Build command    : npm run build
#    Output directory : out`}
            />
            <p>Or connect the Git repository and set the project up once:</p>
            <Table
              head={["Vercel setting", "Value"]}
              rows={[
                ["Root directory", "apps/youpi-demo"],
                ["Framework preset", "Next.js"],
                ["Build command", "npm run build"],
                ["Output directory", "out"],
                ["Install command", "npm install"],
                ["Environment variables", "none required for the demo"],
                ["Node version", "20.x or later"],
              ]}
            />
            <p>
              When you swap the sandbox state machine for the real API, add these variables in{" "}
              <span className="font-mono text-[11.5px]">Project → Settings → Environment Variables</span>:
            </p>
            <CodeBlock
              filename=".env.production"
              language="bash"
              code={`NEXT_PUBLIC_YOUPI_KEY=ypk_live_xxxxxxxx
YOUPI_WEBHOOK_SECRET=whsec_xxxxxxxx        # server only
YOUPI_API_BASE=https://pay.yourdomain.com  # server only
DATABASE_URL=postgres://...                # if you keep the API on Vercel
REDIS_URL=redis://...                      # queue + rate limits`}
            />
            <Callout tone="warn" title="Vercel and payment webhooks">
              Serverless functions do not keep long-lived sockets or in-memory queues. If the real API runs on
              Vercel, move the observer workers and BullMQ queues to an always-on host (Railway, Fly, EC2) and point
              webhooks at that service.
            </Callout>
          </Section>

          <Section id="checklist" eyebrow="12 · Go-live checklist" title="Twelve boxes before real money">
            <ol className="space-y-2">
              {[
                "Merchant handle verified with a ₹1 live test and a matching bank observation.",
                "Webhook endpoint returns 2xx in under 2s and verifies the signature on raw bytes.",
                "Delivery-id dedupe proven by replaying the same event twice.",
                "Order fulfilment reads amount_paise and compares against the local order total.",
                "Payment confirmation never relies on the browser redirect or handler() callback.",
                "Idempotency-Key used on every session create call from the store.",
                "Queue promotion tested by cancelling an active session mid-flow.",
                "Refund path exercised end to end, including the REFUNDED webhook.",
                "GST invoice generated with correct HSN, place of supply and invoice series.",
                "Consent recorded at checkout; privacy, refund and shipping policies published.",
                "Audit log retention, backups and a daily reconciliation report scheduled.",
                "Staff roles reviewed: support cannot see full PII, owner actions are logged.",
              ].map((item, i) => (
                <li key={item} className="flex items-start gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5">
                  <span className="mono-nums mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-paper-deep text-[10px] font-bold text-ink-soft">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[12px] leading-relaxed text-ink-soft">{item}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section id="faq" eyebrow="13 · FAQ" title="Questions that always come up on the call">
            <div className="space-y-2.5">
              {[
                {
                  q: "Do we need a payment aggregator?",
                  a: "Not for the self-hosted model this demo shows: funds move directly into your own UPI handle. Confirm with your bank and adviser whether your volumes and business model require a licensed aggregator instead.",
                },
                {
                  q: "What if the buyer closes the tab after paying?",
                  a: "Nothing is lost. The session keeps its server timestamps, the observer still matches the credit, and the webhook still fires. The buyer can reopen the status link to see the result.",
                },
                {
                  q: "Can two buyers with the same amount be confused?",
                  a: "No. Only one session can be ACTIVE per handle, so attribution is never ambiguous; everyone else waits in the FIFO queue.",
                },
                {
                  q: "Where do the timers live?",
                  a: "In the database as absolute timestamps. Refreshing or restarting cannot extend a 5:00 payment window or a 0:30 verification window.",
                },
                {
                  q: "How is this demo different from production?",
                  a: "Here the state machine runs in your browser with seeded data. Production runs the same states on a server, with real observers, signed webhooks and Postgres persistence.",
                },
              ].map((item) => (
                <details key={item.q} className="group rounded-xl border border-line bg-white px-3.5 py-2.5">
                  <summary className="flex cursor-pointer items-center justify-between gap-2 text-[12.5px] font-semibold text-ink">
                    {item.q}
                    <Icon name="arrow" className="h-3.5 w-3.5 shrink-0 text-ink-mute transition group-open:rotate-90" />
                  </summary>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-mute">{item.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/demo-pack" className="btn-primary">
                Run the demo pack
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link href="/admin/webhooks" className="btn-ghost">
                Inspect a real signature
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
