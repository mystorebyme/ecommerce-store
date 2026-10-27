/**
 * Money never leaves this file as a float. Everything is integer paise
 * (₹1.00 = 100 paise) and rupees only exist for display.
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPaiseShort(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function rupeesToPaise(value: string | number): number {
  const n = typeof value === "number" ? value : Number.parseFloat(value.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  return `${phone.slice(0, 2)}••••••${phone.slice(-2)}`;
}

export function maskSecret(secret: string): string {
  if (secret.length <= 10) return "••••••••";
  return `${secret.slice(0, 8)}${"•".repeat(18)}${secret.slice(-4)}`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function dateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function relativeTime(ts: number, now: number): string {
  const diff = Math.max(0, Math.round((now - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ALPHABET = "0123456789abcdef";

export function randomId(prefix: string, length = 12): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}_${out}`;
}

export function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

export function randomUtr(): string {
  // 12-digit bank reference. Demo-only, never a real UTR.
  return `4${randomDigits(11)}`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Pick black or white text for a hex background (WCAG-ish luminance). */
export function readableOn(hex: string): "#0C1116" | "#FFFFFF" {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#FFFFFF";
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#0C1116" : "#FFFFFF";
}
