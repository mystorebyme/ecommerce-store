// Purpose: Payment success — server-side status (browser ke claim par nahi)

import Link from "next/link";
import { getOrder, getSession, rupees } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata = { title: "Order confirmed" };

export default async function SuccessPage({ searchParams }: { searchParams: { session?: string } }) {
  const session = searchParams.session ? await getSession(searchParams.session) : null;
  const order = session ? await getOrder(session.orderId) : null;
  const paid = session?.status === "SUCCESS";

  return (
    <main className="container">
      <div style={{ maxWidth: 640, margin: "48px auto 80px" }}>
        <div className="panel">
          {paid ? (
            <>
              <div className="badge success">✓ Payment received</div>
              <h1 style={{ fontSize: 28, marginTop: 14 }}>Order confirmed!</h1>
              <p className="muted" style={{ marginTop: 6 }}>
                Bank credit match ho gaya — aapka order pack ho raha hai. SMS par tracking bhejenge.
              </p>
            </>
          ) : (
            <>
              <div className="badge queued">⏳ Confirmation pending</div>
              <h1 style={{ fontSize: 28, marginTop: 14 }}>Payment verify ho raha hai</h1>
              <p className="muted" style={{ marginTop: 6 }}>
                Bank credit aate hi order confirm ho jayega. Ye page refresh karte raho.
              </p>
            </>
          )}

          {order ? (
            <div style={{ marginTop: 20 }}>
              <div className="summary-row">
                <span>Order number</span>
                <span className="mono">{order.number}</span>
              </div>
              <div className="summary-row">
                <span>Amount</span>
                <span className="price">{rupees(order.amountPaise)}</span>
              </div>
              {session?.utr ? (
                <div className="summary-row">
                  <span>UTR / reference</span>
                  <span className="mono">{session.utr}</span>
                </div>
              ) : null}
              <div className="summary-row">
                <span>Status</span>
                <span className="badge success">{order.status}</span>
              </div>
              {order.items.map((item) => (
                <div className="summary-row" key={item.sku}>
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  <span>{rupees(item.lineTotalPaise)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 18 }}>
              Session nahi mila.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            <Link className="btn" href="/">
              Aur shopping karo
            </Link>
            <Link className="btn btn-ghost" href={session ? `/checkout/success?session=${session.sessionId}` : "/"}>
              Refresh status
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
