// Purpose: Checkout — delivery details + real UPI QR (API se)
//
// Server component product load karta hai (price server se), client component
// order + payment banata hai aur status poll karta hai.

import Link from "next/link";
import { QrPayment } from "@/components/checkout/QrPayment";
import { getProduct, rupees } from "@/lib/api";

// Checkout page halka cached (10s) — price/stock API se, payment khud client banata hai.
export const revalidate = 10;

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: { product?: string } }) {
  const product = searchParams.product ? await getProduct(searchParams.product) : null;

  if (!product) {
    return (
      <main className="container">
        <div className="checkout">
          <div className="panel">
            <h1 style={{ fontSize: 24 }}>Kuch select nahi kiya</h1>
            <p className="muted" style={{ marginTop: 8 }}>
              Pehle store se product choose karo, phir checkout khulega.
            </p>
            <div style={{ marginTop: 16 }}>
              <Link className="btn" href="/">
                Shop par jao
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="checkout">
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>Checkout</h1>
          <p className="muted" style={{ marginBottom: 18 }}>
            Secure UPI payment · seedha merchant ke account me
          </p>
          <QrPayment product={product} />
        </div>

        <aside className="panel">
          <h2 style={{ fontSize: 17 }}>Order summary</h2>
          <div style={{ marginTop: 14 }}>
            <div className="summary-row">
              <span>{product.name}</span>
              <span>{rupees(product.pricePaise)}</span>
            </div>
            <div className="summary-row">
              <span>Qty</span>
              <span>1</span>
            </div>
            <div className="summary-row">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="summary-row">
              <span>GST</span>
              <span>Included</span>
            </div>
            <div className="summary-row total">
              <span>Total payable</span>
              <span>{rupees(product.pricePaise)}</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>
            Price server par decide hota hai — QR me wahi amount fix ho jaata hai, isliye galat amount ka
            payment match hi nahi hota.
          </p>
        </aside>
      </div>
    </main>
  );
}
