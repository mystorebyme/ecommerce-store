"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProductArt } from "@/components/ProductArt";
import { Drawer, Icon, PageIntro, StatusPill } from "@/components/ui";
import { products } from "@/lib/config";
import { cn, formatPaise, rupeesToPaise } from "@/lib/format";
import { useDemo } from "@/lib/store";

type Line = { id: string; name: string; pricePaise: number; size: string; qty: number; variant: "kurta" | "tote" | "dupatta" };

const COUPONS: Record<string, { off: number; note: string }> = {
  YOUPI10: { off: 10, note: "10% off demo order" },
  FIRSTPAY: { off: 5000, note: "₹50 off above ₹999" },
};

export default function StorePage() {
  const router = useRouter();
  const { createSession, state } = useDemo();
  const [sizes, setSizes] = useState<Record<string, string>>({
    "aarohi-kurta": "M",
    "kala-tote": "One size",
    "neel-dupatta": "2.5 m",
  });
  const [cart, setCart] = useState<Line[]>([
    {
      id: "aarohi-kurta",
      name: "Aarohi Handloom Kurta",
      pricePaise: 189900,
      size: "M",
      qty: 1,
      variant: "kurta",
    },
  ]);
  const [cartOpen, setCartOpen] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; off: number; note: string } | null>(null);
  const [pincode, setPincode] = useState("");
  const [delivery, setDelivery] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const subtotal = useMemo(() => cart.reduce((sum, l) => sum + l.pricePaise * l.qty, 0), [cart]);
  const discount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.code === "YOUPI10") return Math.round(subtotal * 0.1);
    return subtotal >= 99900 ? appliedCoupon.off : 0;
  }, [appliedCoupon, subtotal]);
  const shipping = subtotal === 0 || subtotal >= 150000 ? 0 : 4900;
  const total = Math.max(0, subtotal - discount) + shipping;

  const items = cart.reduce((n, l) => n + l.qty, 0);

  const add = (product: (typeof products)[number]) => {
    const size = sizes[product.id];
    setCart((prev) => {
      const existing = prev.find((l) => l.id === product.id && l.size === size);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, qty: Math.min(5, l.qty + 1) } : l));
      }
      return [
        ...prev,
        { id: product.id, name: product.name, pricePaise: product.pricePaise, size, qty: 1, variant: product.art },
      ];
    });
    setToast(`${product.name} (${size}) added — ${formatPaise(product.pricePaise)}`);
    window.setTimeout(() => setToast(null), 2600);
  };

  const pay = () => {
    const id = createSession({
      amountPaise: total,
      note: `${items} item(s) · ${cart.map((l) => l.name).join(", ")}`.slice(0, 120),
      source: "store",
      simOutcome: "success",
    });
    setCartOpen(false);
    router.push(`/checkout?session=${id}&from=store`);
  };

  return (
    <>
      <PageIntro
        eyebrow="Surface 01 · Merchant storefront"
        title="A real store that talks to a real checkout"
        copy="Prices, stock and cart live in the store. YouPI only ever receives an order id and an amount — this page is where the story starts for the client."
      >
        <span className="chip">
          <Icon name="bank" className="h-3.5 w-3.5" /> Demo merchant · Jaipur
        </span>
        <span className="chip">
          <Icon name="layers" className="h-3.5 w-3.5" /> Free shipping over ₹1,500
        </span>
        <button onClick={() => setCartOpen(true)} className="btn-dark !py-1.5 !text-[12px]">
          <Icon name="wallet" className="h-3.5 w-3.5" />
          Cart ({items}) · {formatPaise(total)}
        </button>
      </PageIntro>

      <div className="mx-auto w-full max-w-[1180px] px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-mute">
            <span className="font-semibold text-ink">{products.length} products</span> · handloom capsule ·
            made in India
          </p>
          <div className="flex flex-wrap gap-2">
            {["All", "New in", "Handloom", "Under ₹1,000"].map((filter, i) => (
              <span
                key={filter}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11.5px] font-semibold",
                  i === 0 ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-soft",
                )}
              >
                {filter}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const inCart = cart.filter((l) => l.id === product.id).reduce((n, l) => n + l.qty, 0);
            return (
              <article key={product.id} className="card flex flex-col overflow-hidden">
                <ProductArt variant={product.art} className="h-44 rounded-none border-0 border-b" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[14.5px] font-semibold leading-snug text-ink">{product.name}</h2>
                    {product.stock <= 6 && (
                      <span className="shrink-0 rounded-full border border-[#F0DAB0] bg-[#FDF6E9] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-warn">
                        {product.stock} left
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-mute">{product.blurb}</p>
                  <p className="mono-nums mt-2.5 text-[16px] font-semibold text-ink">
                    {formatPaise(product.pricePaise)}
                    <span className="ml-1.5 text-[10.5px] font-normal text-ink-mute">incl. GST</span>
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSizes((prev) => ({ ...prev, [product.id]: size }))}
                        aria-pressed={sizes[product.id] === size}
                        className={cn(
                          "min-w-9 rounded-lg border px-2 py-1 text-[11px] font-semibold transition",
                          sizes[product.id] === size
                            ? "border-ink bg-ink text-white"
                            : "border-line bg-white text-ink-soft hover:border-ink/30",
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => add(product)} className="btn-primary mt-3.5 w-full !text-[12.5px]">
                    <Icon name="wallet" className="h-3.5 w-3.5" />
                    {inCart > 0 ? `In cart (${inCart}) · add another` : "Add to cart"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* pincode + youpi explainer */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card p-5">
            <p className="label">Delivery check</p>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Enter a pincode to see the demo shipping estimate (nothing is stored).
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!/^\d{6}$/.test(pincode)) {
                  setDelivery("Enter a valid 6-digit Indian pincode.");
                  return;
                }
                setDelivery(
                  `Delivers to ${pincode} in 3–5 working days · prepaid UPI · COD available on orders under ₹5,000`,
                );
              }}
            >
              <input
                className="field max-w-[180px]"
                placeholder="302001"
                inputMode="numeric"
                value={pincode}
                onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                aria-label="Pincode"
              />
              <button className="btn-ghost">Check</button>
            </form>
            {delivery && <p className="mt-2.5 text-[12px] text-brand">{delivery}</p>}
          </div>

          <div className="card bg-ink p-5 text-white">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                What YouPI receives
              </p>
              <span className="rounded-full border border-white/20 px-2 py-0.5 font-mono text-[10px] text-white/60">
                POST /api/v1/payments
              </span>
            </div>
            <pre className="mt-3 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-[#CFE3DC]">
{`{
  "order_id": "YP-1041",
  "amount": 1899.00,
  "currency": "INR",
  "customer": { "phone": "98••••••10" },
  "metadata": { "items": 1 }
}`}
            </pre>
            <p className="mt-3 text-[11px] leading-relaxed text-white/50">
              No card data, no CVV, no bank credentials — and the amount is re-validated server-side before a QR
              is ever rendered.
            </p>
          </div>
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 animate-rise rounded-full border border-ink bg-ink px-4 py-2.5 text-[12px] font-medium text-white shadow-ledger">
          {toast}
        </div>
      )}

      <Drawer open={cartOpen} onClose={() => setCartOpen(false)} title={`Your cart · ${items} item(s)`}>
        {cart.length === 0 ? (
          <p className="text-[13px] text-ink-mute">Cart is empty.</p>
        ) : (
          <div className="space-y-3">
            {cart.map((line) => (
              <div key={`${line.id}-${line.size}`} className="flex gap-3 rounded-xl border border-line bg-white p-2.5">
                <ProductArt variant={line.variant} className="h-16 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-ink">{line.name}</p>
                  <p className="text-[11px] text-ink-mute">Size {line.size}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          setCart((prev) =>
                            prev
                              .map((l) =>
                                l.id === line.id && l.size === line.size ? { ...l, qty: l.qty - 1 } : l,
                              )
                              .filter((l) => l.qty > 0),
                          )
                        }
                        className="grid h-6 w-6 place-items-center rounded-md border border-line text-ink-soft"
                        aria-label={`Remove one ${line.name}`}
                      >
                        −
                      </button>
                      <span className="mono-nums w-5 text-center text-[12px]">{line.qty}</span>
                      <button
                        onClick={() =>
                          setCart((prev) =>
                            prev.map((l) =>
                              l.id === line.id && l.size === line.size
                                ? { ...l, qty: Math.min(5, l.qty + 1) }
                                : l,
                            ),
                          )
                        }
                        className="grid h-6 w-6 place-items-center rounded-md border border-line text-ink-soft"
                        aria-label={`Add one ${line.name}`}
                      >
                        +
                      </button>
                    </div>
                    <span className="mono-nums text-[12.5px] font-semibold">
                      {formatPaise(line.pricePaise * line.qty)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-line bg-white p-3">
              <p className="label">Coupon</p>
              <div className="mt-2 flex gap-2">
                <input
                  className="field !py-2 !text-[12px]"
                  placeholder="YOUPI10"
                  value={coupon}
                  onChange={(event) => setCoupon(event.target.value.toUpperCase())}
                  aria-label="Coupon code"
                />
                <button
                  onClick={() => {
                    const found = COUPONS[coupon.trim()];
                    if (!found) {
                      setAppliedCoupon(null);
                      setToast("That coupon is not valid in the demo");
                      window.setTimeout(() => setToast(null), 2200);
                      return;
                    }
                    setAppliedCoupon({ code: coupon.trim(), ...found });
                  }}
                  className="btn-ghost !py-2 !text-[12px]"
                >
                  Apply
                </button>
              </div>
              {appliedCoupon && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ok">
                  <Icon name="check" className="h-3 w-3" /> {appliedCoupon.code} · {appliedCoupon.note}
                </p>
              )}
            </div>

            <dl className="space-y-1.5 rounded-xl border border-line bg-paper p-3 text-[12px]">
              <div className="flex justify-between">
                <dt className="text-ink-mute">Subtotal</dt>
                <dd className="mono-nums">{formatPaise(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-ok">
                  <dt>Discount</dt>
                  <dd className="mono-nums">−{formatPaise(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-mute">Shipping</dt>
                <dd className="mono-nums">{shipping === 0 ? "Free" : formatPaise(shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-[13px] font-semibold">
                <dt>Payable</dt>
                <dd className="mono-nums">{formatPaise(total)}</dd>
              </div>
            </dl>

            <button onClick={pay} className="btn-primary w-full">
              <Icon name="qr" className="h-4 w-4" />
              Pay {formatPaise(total)} with YouPI
            </button>
            <p className="text-center text-[10.5px] leading-relaxed text-ink-mute">
              Amount in paise: <span className="font-mono">{total}</span> · sent to the gateway as an integer
            </p>

            <div className="flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2">
              <span className="text-[11px] text-ink-mute">Gateway status</span>
              <StatusPill status={state.settings.testMode ? "ACTIVE" : "SUCCESS"} />
            </div>
            <Link href="/checkout" className="btn-ghost w-full !text-[12px]" onClick={() => setCartOpen(false)}>
              Open checkout without a cart
            </Link>
          </div>
        )}
      </Drawer>
    </>
  );
}
