// Purpose: Policy pages — content/ ke markdown se

import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";

const ALLOWED = new Set([
  "privacy-policy",
  "shipping-policy",
  "refund-and-return-policy",
  "terms-and-conditions",
]);

export const dynamic = "force-dynamic";

export default async function PolicyPage({ params }: { params: { slug: string } }) {
  if (!ALLOWED.has(params.slug)) notFound();

  let content = "";
  try {
    content = await readFile(path.join(process.cwd(), "src/content/policies", `${params.slug}.md`), "utf8");
  } catch {
    notFound();
  }

  return (
    <main className="container">
      <div style={{ maxWidth: 720, margin: "40px auto 72px" }}>
        <Link href="/" className="muted">
          ← Store
        </Link>
        <h1 style={{ fontSize: 30, margin: "14px 0 8px", textTransform: "capitalize" }}>
          {params.slug.replace(/-/g, " ")}
        </h1>
        <div className="note warn" style={{ marginBottom: 18 }}>
          Draft — launch se pehle apna asli policy text daalo (content/policies/{params.slug}.md).
        </div>
        <div className="panel">
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "inherit", fontSize: 14 }}>{content}</pre>
        </div>
      </div>
    </main>
  );
}
