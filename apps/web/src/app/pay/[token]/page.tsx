// Purpose: Payment link page — amount server se aata hai, URL se nahi
//
// FIXED link: amount screen par locked (buyer badal nahi sakta).
// OPEN link: buyer amount daalta hai, min/max server-side validate hote hain.

import Link from "next/link";
import { LinkPayment } from "@/components/pay/LinkPayment";
import { getLink, rupees } from "@/lib/api";

export const revalidate = 0;

export const metadata = { title: "Pay" };

export default async function PayLinkPage({ params }: { params: { token: string } }) {
  const link = await getLink(params.token);

  if (!link) {
    return (
      <main className="container">
        <div className="panel" style={{ maxWidth: 520 }}>
          <h1 style={{ fontSize: 22 }}>Ye link maujood nahi hai</h1>
          <p className="muted" style={{ marginTop: 8 }}>
            Link expire ya delete ho gaya ho sakta hai. Merchant se naya link maango.
          </p>
          <Link className="btn" href="/" style={{ marginTop: 16, display: "inline-block" }}>
            Store par jao
          </Link>
        </div>
      </main>
    );
  }

  const blocked = link.status !== "ACTIVE";

  return (
    <main className="container">
      <div className="checkout">
        <div>
          <p className="eyebrow">Payment request</p>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>{link.title}</h1>
          <p className="muted" style={{ marginBottom: 18 }}>
            {link.kind === "FIXED"
              ? `${rupees(link.amountPaise ?? 0)} — amount fix hai, aap badal nahi sakte.`
              : `Aap amount choose karte ho (${rupees(link.minAmountPaise ?? 100)} – ${rupees(link.maxAmountPaise ?? 0)}).`}
          </p>

          {blocked ? (
            <div className="panel">
              <div className="note warn">
                Ye link ab {link.status === "EXPIRED" ? "expire ho chuka hai" : link.status === "DISABLED" ? "band kar diya gaya hai" : "use ho chuka hai"} —
                payment nahi ho sakta. Merchant se naya link lo.
              </div>
            </div>
          ) : (
            <LinkPayment link={link} />
          )}
        </div>

        <aside className="panel">
          <h2 style={{ fontSize: 17 }}>Kaise pay karna hai</h2>
          <ol className="steps">
            <li>Naam + mobile daalo, “Pay” dabao</li>
            <li>QR scan karo ya UPI app kholo</li>
            <li>Exact amount pay karo — kam/zyada nahi</li>
            <li>Ye page khula rakho, 2–5 second me confirm ho jayega</li>
          </ol>
          <div className="note ok" style={{ marginTop: 14 }}>
            Paisa seedha <strong>{link.payee.name}</strong> ke UPI par jaata hai
            (<span className="mono">{link.payee.vpa}</span>) — koi payment gateway beech me nahi.
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            {link.remainingUses} payment{link.remainingUses === 1 ? "" : "s"} is link par baaki
            {link.expiresAt ? ` · valid till ${new Date(link.expiresAt).toLocaleString("en-IN")}` : ""}
          </p>
        </aside>
      </div>
    </main>
  );
}
