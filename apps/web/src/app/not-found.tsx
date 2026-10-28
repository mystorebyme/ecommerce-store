// Purpose: 404

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container">
      <div className="panel" style={{ maxWidth: 520, margin: "64px auto" }}>
        <div className="badge failed">404</div>
        <h1 style={{ fontSize: 26, marginTop: 12 }}>Ye page nahi mila</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Link purana ho sakta hai. Store par wapas chalein.
        </p>
        <div style={{ marginTop: 18 }}>
          <Link className="btn" href="/">
            Store kholo
          </Link>
        </div>
      </div>
    </main>
  );
}
