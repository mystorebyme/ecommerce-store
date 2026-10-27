// Purpose: Paise <-> rupees conversion (kabhi float nahi)
//
// Critical rule #1: paisa integer paise me. Float rupees se rounding bug aata hai
// (0.1 + 0.2 problem). Isliye DB, API, webhook — sab jagah integer paise, aur
// sirf screen par dikhate waqt string me convert.

export const PAISE_PER_RUPEE = 100;

/** ₹499.00 → 49900. Input string/number dono, rounding banker's nahi — half-up. */
export function rupeesToPaise(rupees: string | number): number {
  const raw = typeof rupees === "number" ? rupees.toFixed(2) : rupees.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) throw new Error(`Invalid rupee amount: ${rupees}`);
  const [, sign, whole, fraction] = match;
  const paise = Number(whole) * PAISE_PER_RUPEE + Number((fraction ?? "0").padEnd(2, "0"));
  return sign ? -paise : paise;
}

/** 49900 → "499.00" (UI ke liye, koi number math nahi). */
export function paiseToRupees(paise: number): string {
  assertIntegerPaise(paise);
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / PAISE_PER_RUPEE);
  const fraction = String(abs % PAISE_PER_RUPEE).padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

/** 49900 → "₹499.00" (Indian grouping ke saath: ₹1,23,499.00). */
export function formatInr(paise: number): string {
  assertIntegerPaise(paise);
  const plain = paiseToRupees(Math.abs(paise));
  const [whole, fraction] = plain.split(".") as [string, string];
  const lastThree = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}` : lastThree;
  return `${paise < 0 ? "-" : ""}₹${grouped}.${fraction}`;
}

export function assertIntegerPaise(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error(`Paise must be an integer, got ${value} — rupees float me mat bhejo.`);
  }
}

/** 100 paise (₹1) se kam amount provider accept nahi karta. */
export function isValidChargeAmount(paise: number): boolean {
  return Number.isInteger(paise) && paise >= 100 && paise <= 50_000_000;
}

/** Sum lines ka total — reducer me integer hi rehta hai. */
export function sumPaise(values: number[]): number {
  return values.reduce((total, value) => {
    assertIntegerPaise(value);
    return total + value;
  }, 0);
}
