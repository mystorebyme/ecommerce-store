// Purpose: Placeholder screen for routes jo abhi implement nahi hue

import Link from "next/link";

export function ComingSoon({ title, note }: { title: string; note?: string }) {
  return (
    <main className="container">
      <div className="panel" style={{ maxWidth: 560, margin: "56px auto" }}>
        <div className="badge queued">Phase 2</div>
        <h1 style={{ fontSize: 24, marginTop: 12 }}>{title}</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          {note ?? "Ye screen abhi ban rahi hai. Payment, orders aur checkout pehle se live hain."}
        </p>
        <div style={{ marginTop: 18 }}>
          <Link className="btn" href="/">
            Store par jao
          </Link>
        </div>
      </div>
    </main>
  );
}
