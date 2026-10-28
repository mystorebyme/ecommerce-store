// Purpose: Home = store — catalog API se live

import Link from "next/link";
import { listProducts, rupees } from "@/lib/api";

// ISR: page CDN par 30s tak cached rehta hai — har visitor par function nahi chalta.
// Catalog badle to `revalidatePath("/")` ya thoda intezaar (stale-while-revalidate).
export const revalidate = 30;

const ART = ["#0b5e4f", "#b4530f", "#3c4a7a", "#7a3c5f", "#2f6b3a", "#8a5a2b"];

export default async function StorePage() {
  const products = await listProducts();

  return (
    <main className="container">
      <section className="hero">
        <h1>Everyday Indian wear, priced honestly.</h1>
        <p>
          Handpicked kurtas, shirts aur co-ords — GST invoice ke saath. Payment aapke UPI app se, seedha
          hamare account me. Koi payment gateway beech me nahi, isliye koi extra charge bhi nahi.
        </p>
        <div className="trust">
          <span className="pill">🔒 <strong>UPI</strong> · GPay / PhonePe / Paytm</span>
          <span className="pill">🚚 Free shipping ₹999+</span>
          <span className="pill">↩️ 7-day easy returns</span>
          <span className="pill">🧾 GST invoice</span>
        </div>
        <p style={{ marginTop: 14 }}>
          <Link className="btn btn-ghost" href="/checkout?product=prod_test1" prefetch>
            ₹1 ka test payment karo →
          </Link>
        </p>
      </section>

      <div className="section-head">
        <h2>Shop all</h2>
        <span>{products.length} products</span>
      </div>

      {products.length === 0 ? (
        <div className="empty">
          <p>
            <strong>Catalog load nahi hua.</strong>
          </p>
          <p className="muted">
            API chal raha hai? <span className="mono">npm run api:dev</span> (port 4000) aur seed{" "}
            <span className="mono">npx tsx database/seeds/seed.ts</span>
          </p>
        </div>
      ) : (
        <div className="grid">
          {products.map((product, index) => (
            <article className="card" key={product.id}>
              <Link href={`/products/${product.id}`} className="card-art" style={{ background: ART[index % ART.length] }}>
                {product.name.slice(0, 2).toUpperCase()}
              </Link>
              <div className="card-body">
                <h3>{product.name}</h3>
                <div className="price">
                  {rupees(product.pricePaise)}
                  <small>incl. GST</small>
                </div>
                <div className={product.inStock ? "stock" : "stock out"}>
                  {product.inStock ? `In stock · ${product.stock} left` : "Sold out"}
                </div>
                <Link
                  className="btn btn-block"
                  href={product.inStock ? `/checkout?product=${product.id}` : `/products/${product.id}`}
                  aria-disabled={!product.inStock}
                >
                  {product.inStock ? "Buy now · UPI" : "Sold out"}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
