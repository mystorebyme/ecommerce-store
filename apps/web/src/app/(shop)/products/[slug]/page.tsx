// Purpose: Product detail — size choose karke UPI checkout par jaao
//
// `[slug]` actually product id hai (API `/products/:id`) — SEO ke liye aage slug add hoga.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, listProducts, rupees } from "@/lib/api";

// ISR: page CDN par 30s tak cached rehta hai — har visitor par function nahi chalta.
// Catalog badle to `revalidatePath("/")` ya thoda intezaar (stale-while-revalidate).
export const revalidate = 30;

/**
 * Build par hi saare product pages pre-render ho jaate hain — pehla visitor bhi
 * CDN se instant page paata hai (on-demand render ka intezaar nahi).
 */
export async function generateStaticParams() {
  const products = await listProducts();
  return products.map((product) => ({ slug: product.id }));
}

/** Per-product title/description — SEO + browser tab me turant naam. */
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description: `${product.name} — ${rupees(product.pricePaise)} (incl. GST). UPI se seedha merchant ke account me payment.`,
    openGraph: { title: product.name, type: "website" },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await getProduct(params.slug);
  if (!product) notFound();

  return (
    <main className="container">
      <div className="checkout">
        <div className="panel">
          <div className="card-art" style={{ background: "#0b5e4f", borderRadius: 14, fontSize: 48 }}>
            {product.name.slice(0, 2).toUpperCase()}
          </div>
          <h1 style={{ marginTop: 20, fontSize: 26 }}>{product.name}</h1>
          <p className="muted">
            SKU {product.sku} · 100% cotton · machine wash cold. Handcrafted in India, GST invoice included.
          </p>
          <div className="price" style={{ fontSize: 20, marginTop: 10 }}>
            {rupees(product.pricePaise)} <small>incl. GST</small>
          </div>
        </div>

        <aside className="panel">
          <h2 style={{ fontSize: 17 }}>Order summary</h2>
          <div className="summary-row">
            <span>{product.name}</span>
            <span>{rupees(product.pricePaise)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping</span>
            <span>Free</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{rupees(product.pricePaise)}</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <Link className="btn btn-block" href={`/checkout?product=${product.id}`}>
              {product.inStock ? "Pay with UPI" : "Sold out"}
            </Link>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Payment seedha hamare UPI account me jaata hai — GPay, PhonePe, Paytm, koi bhi UPI app.
          </p>
        </aside>
      </div>
    </main>
  );
}
