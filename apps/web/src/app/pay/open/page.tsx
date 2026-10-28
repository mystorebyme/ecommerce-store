// Purpose: Open payment page — customer khud amount daalta hai (min/max server se)

import Link from "next/link";
import { OpenPayment } from "@/components/pay/OpenPayment";
import { getPayLimits, rupees } from "@/lib/api";

export const revalidate = 30;

export const metadata = { title: "Pay any amount" };

export default async function OpenPayPage() {
  const limits = await getPayLimits();

  return (
    <main className="container">
      <div className="checkout">
        <div>
          <p className="eyebrow">Payment</p>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>Kuch bhi pay karo</h1>
          <p className="muted" style={{ marginBottom: 18 }}>
            Amount aap choose karo — {rupees(limits.minAmountPaise)} se {rupees(limits.maxAmountPaise)} tak.
          </p>
          <OpenPayment minAmountPaise={limits.minAmountPaise} maxAmountPaise={limits.maxAmountPaise} />
        </div>
        <aside className="panel">
          <h2 style={{ fontSize: 17 }}>Note</h2>
          <p className="muted" style={{ marginTop: 10 }}>
            Amount server par validate hota hai aur QR me lock ho jaata hai. Payment confirm sirf bank credit
            proof se hota hai — screenshot se nahi.
          </p>
          <Link className="btn btn-ghost" href="/" style={{ marginTop: 14, display: "inline-block" }}>
            Store par jao
          </Link>
        </aside>
      </div>
    </main>
  );
}
