// Purpose: money helpers ke tests — integer paise rule ka guard
//
// `node --test` se chalta hai: npm test (tsx --test)

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertIntegerPaise,
  formatInr,
  isValidChargeAmount,
  paiseToRupees,
  rupeesToPaise,
  sumPaise,
} from "./money";

test("rupeesToPaise: string aur number dono, float bug nahi", () => {
  assert.equal(rupeesToPaise("499"), 49900);
  assert.equal(rupeesToPaise("499.5"), 49950);
  assert.equal(rupeesToPaise("499.05"), 49905);
  assert.equal(rupeesToPaise(1499.99), 149999);
  // 0.1 + 0.2 problem: float se ye 30 nahi aata
  assert.equal(rupeesToPaise("0.10") + rupeesToPaise("0.20"), 30);
});

test("rupeesToPaise: invalid input par error", () => {
  assert.throws(() => rupeesToPaise("499.999"), /Invalid rupee amount/);
  assert.throws(() => rupeesToPaise("abc"), /Invalid rupee amount/);
});

test("paiseToRupees: exact two decimals", () => {
  assert.equal(paiseToRupees(49900), "499.00");
  assert.equal(paiseToRupees(5), "0.05");
  assert.equal(paiseToRupees(123456789), "1234567.89");
});

test("formatInr: Indian grouping (lakh/crore)", () => {
  assert.equal(formatInr(49900), "₹499.00");
  assert.equal(formatInr(123456789), "₹12,34,567.89");
  assert.equal(formatInr(100000), "₹1,000.00");
});

test("assertIntegerPaise: float paise reject", () => {
  assert.throws(() => assertIntegerPaise(499.5), /Paise must be an integer/);
  assert.doesNotThrow(() => assertIntegerPaise(499));
});

test("isValidChargeAmount: provider ki limit", () => {
  assert.equal(isValidChargeAmount(100), true);
  assert.equal(isValidChargeAmount(99), false);
  assert.equal(isValidChargeAmount(50_000_001), false);
  assert.equal(isValidChargeAmount(49_900.5), false);
});

test("sumPaise: integer sum", () => {
  assert.equal(sumPaise([49900, 74900, 100]), 124900);
  assert.throws(() => sumPaise([49900, 0.5]), /integer/);
});
