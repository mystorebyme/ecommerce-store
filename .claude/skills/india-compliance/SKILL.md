---
name: india-compliance
description: Use when building invoices, tax, user consent, account deletion, privacy or policy pages for the Indian market.
---

# India compliance

Always tell the owner to confirm legal and tax details with a CA or lawyer. Do not state tax rates or legal thresholds as facts.

## GST invoice
- Invoice fields: seller GSTIN, invoice number (sequential, no gaps), date, HSN code per item, taxable value, place of supply, CGST+SGST for same-state or IGST for other-state, total, buyer details.
- GST rates, HSN codes and seller details are configuration (`settings` module), never hardcoded.
- Invoices are stored as records; keep them even when a user is erased.

## DPDP (personal data)
- Signup and checkout record consent: purpose, timestamp, policy version, in the `consents` module.
- Provide data download and account deletion in `account/privacy`.
- Erasure means anonymizing personal data (name, phone, address, email) while keeping tax and invoice records that the law requires.
- Do not log personal data (phone, address, full email) in application logs.

## Policy pages
Privacy, terms, refund/return and shipping policy pages must exist before go-live (payment gateways usually ask for them). Write original text; do not copy other stores.
