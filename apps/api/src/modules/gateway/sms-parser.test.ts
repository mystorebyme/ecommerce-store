// Purpose: sms-parser tests — real bank SMS formats

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBankMessage } from "./sms-parser";

test("HDFC format: credited + UPI ref", () => {
  const parsed = parseBankMessage(
    "Rs.1,899.00 credited to your a/c XX1234 on 28-10-26. UPI ref 412345678901.",
  )!;
  assert.equal(parsed.amountPaise, 189900);
  assert.equal(parsed.utr, "412345678901");
  assert.equal(parsed.isCredit, true);
  assert.equal(parsed.senderVpa, null);
});

test("ICICI format: INR amount + sender VPA", () => {
  const parsed = parseBankMessage(
    "INR 1,899 credited to ICICI Bank A/c XX1234 from RAHUL@OKAXIS. UPI:412345678901",
  )!;
  assert.equal(parsed.amountPaise, 189900);
  assert.equal(parsed.utr, "412345678901");
  assert.equal(parsed.senderVpa, "rahul@okaxis");
});

test("Paytm/UPI P2M format: UTR in path", () => {
  const parsed = parseBankMessage(
    "Acct XX1234 credited: INR 1,299.00 (UPI/P2M/412345678901/aarav@oksbi)",
  )!;
  assert.equal(parsed.amountPaise, 129900);
  assert.equal(parsed.utr, "412345678901");
});

test("decimal amount bhi sahi paise me", () => {
  const parsed = parseBankMessage("You have received Rs 499.50 from AARAV on 28-10-2026. UTR 412345678901")!;
  assert.equal(parsed.amountPaise, 49950);
});

test("debit message ignore hota hai", () => {
  assert.equal(
    parseBankMessage("Rs.500.00 debited from your a/c XX1234 on 28-10-26. UPI ref 412345678901."),
    null,
  );
});

test("UTR missing par parse fail (guessing nahi)", () => {
  assert.equal(parseBankMessage("Rs.1,899.00 credited to your a/c XX1234."), null);
});

test("amount missing par parse fail", () => {
  assert.equal(parseBankMessage("Your a/c credited. UPI ref 412345678901"), null);
});
