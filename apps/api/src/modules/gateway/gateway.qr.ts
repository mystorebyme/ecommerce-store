// Purpose: Per-order single-use fixed-amount UPI QR (string + vector SVG)
//
// Yahan koi payment aggregator nahi hai: QR sidha merchant ke apne VPA par jaata hai.
//   upi://pay?pa=<vpa>&pn=<payee>&am=<rupees>&cu=INR&tn=<reference>
//
// Paisa string me rupees me jaata hai (UPI spec `am` field), par hamara internal
// amount integer paise hi rehta hai — conversion sirf yahan, ek jagah.

import QRCode from "qrcode";
import { paiseToRupees } from "../../utils/money";

export interface UpiQrInput {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  /** Transaction note — 6-20 chars, uppercase. Bank statement me isi se match karte hain. */
  reference: string;
  /** Unique transaction ref (`tr`) — order id. Bank/PSP reconciliation ke liye. */
  transactionRef?: string;
  /** UPI merchant code (`mc`) — bank/PSP ne diya ho to. */
  merchantCode?: string | null;
}

const VPA_PATTERN = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/;

export function assertValidVpa(vpa: string): void {
  if (!VPA_PATTERN.test(vpa)) {
    throw new Error(`Invalid VPA "${vpa}" — format: name@bank (e.g. store@okhdfcbank)`);
  }
}

/** UPI deep-link jo buyer ke bank app me khulta hai (aur QR me encode hota hai). */
export function buildUpiString({
  vpa,
  payeeName,
  amountPaise,
  reference,
  transactionRef,
  merchantCode,
}: UpiQrInput): string {
  assertValidVpa(vpa);
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new Error("UPI amount integer paise me aur kam se kam ₹1 hona chahiye");
  }
  // UPI apps `+` ko space nahi samajhte — isliye khud encode karte hain (`%20`).
  const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "%20");
  const params = [
    `pa=${encode(vpa)}`,
    `pn=${encode(payeeName)}`,
    `am=${encode(paiseToRupees(amountPaise))}`,
    "cu=INR",
    `tn=${encode(reference)}`,
  ];
  // `tr` = unique transaction reference; `mc` sirf tab jab merchant code ho.
  if (transactionRef) params.push(`tr=${encode(transactionRef)}`);
  if (merchantCode) params.push(`mc=${encode(merchantCode)}`);
  // `@` ko encode nahi karte — har UPI app plain VPA expect karta hai.
  return `upi://pay?${params.join("&").replace(/%40/g, "@")}`;
}

/** Vector QR — retina par bhi crisp, koi external service nahi. */
export async function buildQrSvg(upiString: string): Promise<string> {
  return QRCode.toString(upiString, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
    color: { dark: "#0C1116", light: "#FFFFFF" },
  });
}

/** Data URL — seedha `<img src>` me daal sakte ho (file storage ki zarurat nahi). */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
