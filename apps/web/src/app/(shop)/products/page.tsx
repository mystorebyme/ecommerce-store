// Purpose: Full catalog page

import Link from "next/link";
import { listProducts, rupees } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shop all" };

export default async function ProductsPage() {
  const products = await listProducts();

  return (
    <main className="container">
      <div className="section-head">
        <h2>Shop all</h2>
        <span>{products.length} products</span>
      </div>
      {products.length === 0 ? (
        <div className="empty">Catalog khaali hai — API seed karo.</div>
      ) : (
        <div className="grid">
          {products.map((product) => (
            <article className="card" key={product.id}>
              <Link href={`/products/${product.id}`} className="card-art" style={{ background: "#0b5e4f" }}>
                {product.name.slice(0, 2).toUpperCase()}
              </Link>
              <div className="card-body">
                <h3>{product.name}</h3>
                <div className="price">{rupees(product.pricePaise)}</div>
                <div className={product.inStock ? "stock" : "stock out"}>
                  {product.inStock ? `${product.stock} in stock` : "Sold out"}
                </div>
                <Link className="btn btn-block" href={`/checkout?product=${product.id}`}>
                  Buy now
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
