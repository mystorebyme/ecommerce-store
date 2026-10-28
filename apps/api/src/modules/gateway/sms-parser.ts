// Purpose: Bank SMS / email text ko normalise karna (observer ka parser)
//
// Android observer bank ka SMS padhta hai aur **raw text** bhej deta hai. Parsing
// server par hoti hai taaki rules ek jagah rahein aur app update kiye bina sudhar sake.
//
// Rule: jo parse na ho use REJECT karte hain (guessing nahi) — warna galat amount
// se galat order PAID ho sakta hai.

export interface ParsedCredit {
  amountPaise: number;
  utr: string;
  senderVpa: string | null;
  bankName: string | null;
  isCredit: boolean;
}

const DEBIT_WORDS = /\b(debited|debit|withdrawn|withdrawal|sent|paid to|spent)\b/i;
const CREDIT_WORDS = /\b(credited|credit|received|deposited|refund)\b/i;

/** Debit-only message — observer isse pehle hi reject karta hai. */
export function isDebitMessage(rawText: string): boolean {
  return DEBIT_WORDS.test(rawText) && !CREDIT_WORDS.test(rawText);
}

/**
 * Real duniya ke common formats jo handle hote hain:
 *  - "Rs.1,899.00 credited to your a/c XX1234 on 28-10-26. UPI ref 412345678901."
 *  - "INR 1,899 credited to HDFC Bank A/c XX1234 from RAHUL@OKAXIS. UPI:412345678901"
 *  - "You have received Rs 499 from AARAV SHARMA (aarav@okhdfcbank) on 28-10-2026. UTR 412345678901"
 *  - "Acct XX1234 credited: INR 1,299.00 (UPI/P2M/412345678901/aarav@oksbi)"
 */
export function parseBankMessage(rawText: string): ParsedCredit | null {
  const text = rawText.replace(/\s+/g, " ").trim();
  if (!text) return null;

  // Debit message bilkul ignore — warna refund/withdrawal ko credit samajh liya jaayega.
  if (DEBIT_WORDS.test(text) && !CREDIT_WORDS.test(text)) return null;

  const amountPaise = extractAmountPaise(text);
  const utr = extractUtr(text);
  if (amountPaise === null || utr === null) return null;

  return {
    amountPaise,
    utr,
    senderVpa: extractSenderVpa(text),
    bankName: extractBankName(text),
    isCredit: CREDIT_WORDS.test(text),
  };
}

function extractAmountPaise(text: string): number | null {
  // Primary: currency marker ke saath — "Rs.1,899.00", "INR 1899", "₹ 1,899"
  // Fallback: bina currency ke chhota amount ("Credited: 1,899.00") — par 12-digit UTR
  // ko amount mat samajhna (isliye max 5 digits + digit boundaries).
  const match =
    /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i.exec(text) ??
    /(?:credited|received)[^0-9]{0,24}(?<![0-9])([0-9]{1,5}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)(?![0-9])/i.exec(text);
  if (!match?.[1]) return null;

  const plain = match[1].replace(/,/g, "");
  const [whole, fraction = ""] = plain.split(".");
  const rupees = Number(whole);
  const paise = Number(fraction.padEnd(2, "0").slice(0, 2));
  if (!Number.isFinite(rupees) || rupees <= 0) return null;

  const total = rupees * 100 + paise;
  return Number.isInteger(total) && total >= 100 ? total : null;
}

function extractUtr(text: string): string | null {
  // "UPI ref 412345678901", "UTR: 412345678901", "(UPI/P2M/412345678901/abc@okaxis)"
  const labelled =
    /(?:utr|rrn|upi\s*(?:ref|reference|txn|transaction)?\s*[:#/-]?)\s*([0-9]{9,18})/i.exec(text) ??
    /(?:ref(?:erence)?\s*(?:no\.?|number)?\s*[:#-]?\s*)([0-9]{9,18})/i.exec(text);
  if (labelled?.[1]) return labelled[1];

  // UPI/P2M/<utr>/<vpa> format
  const p2m = /upi\/p2m\/([0-9]{9,18})\//i.exec(text);
  if (p2m?.[1]) return p2m[1];

  // Aakhri fallback: 12-digit standalone number (bank SMS me UTR aisa hi hota hai)
  const bare = /\b([0-9]{12})\b/.exec(text);
  return bare?.[1] ?? null;
}

function extractSenderVpa(text: string): string | null {
  const match = /([a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32})/.exec(text);
  return match?.[1]?.toLowerCase() ?? null;
}

function extractBankName(text: string): string | null {
  const banks = [
    "HDFC",
    "ICICI",
    "SBI",
    "State Bank",
    "Axis",
    "Kotak",
    "IDFC",
    "Yes Bank",
    "Paytm",
    "PhonePe",
    "Google Pay",
    "AU Small Finance",
    "Bank of Baroda",
    "Punjab National",
  ];
  const found = banks.find((bank) => new RegExp(bank.replace(/\s/g, "\\s"), "i").test(text));
  return found ?? null;
}
