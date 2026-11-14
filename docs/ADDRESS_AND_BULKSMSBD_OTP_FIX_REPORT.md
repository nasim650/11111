# Bangladesh Smart Address & BulkSMSBD Phone OTP Integration Report

**Repository:** `/Users/nasimp/Desktop/11111/1`  
**Branch:** `phase-1b-implementation`  
**Date:** 2026-11-14  
**Status:** Successfully Implemented, Tested (53/53 Tests Passing), and Verified

---

## 1. Executive Summary

This report documents the resolution of two critical customer-blocking issues in Khati Khadyo:
1. **Smart Delivery Address Saving Failure:** Customers were blocked from saving Bangladesh Smart Addresses because metadata serialized via `packSmartAddress` (`__BDMETA__...`) was rejected by the server's regex and 240-character constraint. Because saving failed, no `selectedAddressId` was set, blocking checkout with *"Please select delivery address."*
2. **BulkSMSBD Phone OTP Verification Integration:** Integrated the official BulkSMSBD SMS gateway adapter via a secure server-to-server POST contract, normalized phone numbers to `8801XXXXXXXXX`, enforced phone verification before checkout for logged-in accounts, and provided an interactive Bengali verification UI directly on the checkout page.

---

## 2. Issue 1: Smart Delivery Address Serialization & Validation

### Root Cause
- In the client, `SmartAddressForm` serialized the 12 fields of the Bangladesh smart address into the `address` column using `packSmartAddress`:
  `"{addressDetail} | Area/Union: {area} | Upazila: {upazila} | __BDMETA__{...json...}"`
- In `src/lib/validation.ts`, `validateAddressParts()` passed the raw address string through `cleanText(value, 240, true)` using `ADDRESS_REGEX`.
- This caused two fatal failures:
  1. The string exceeded 240 characters whenever detailed address and metadata were combined.
  2. The regex rejected JSON delimiters (`{`, `"`, `|`) and Unicode Bengali numerals (`০-৯`).
- When saving an address via `POST /api/addresses` or `PUT /api/addresses/[id]`, the server returned HTTP 400 with `"Address is required and must be 240 characters or fewer"`.
- Consequently, no address was saved, `selectedAddressId` remained empty, and checkout was blocked.

### Technical Fix
1. **Smart Metadata Parsing & Validation (`src/lib/validation.ts`):**
   - In `validateAddressParts()`, the server now checks if `address` contains `__BDMETA__`.
   - If present, it safely separates human-readable address text and JSON metadata.
   - Strictly validates each structural field:
     - `addressDetail`: up to 240 characters, allows Bengali text and punctuation.
     - Administrative hierarchy: `division` (max 60), `district` (max 80), `upazila`/`city` (max 80), `unionOrArea` (max 100), `landmark` (max 120), `deliveryNote` (max 200).
     - Contact fields: `altPhone` (valid BD phone), `label` (max 30), `postalCode` (max 30).
   - Re-packs the metadata using the official `packSmartAddress()` utility. This strips any malicious or untrusted properties that an attacker might attempt to inject into the JSON payload.
2. **Unicode & Bengali Numerals Support:**
   - Updated `NAME_REGEX` and `ADDRESS_REGEX` in `src/lib/validation.ts` to use `\p{N}` instead of `\d`, supporting both ASCII digits (`0-9`) and Bengali digits (`০-৯`), as well as Bengali punctuation (`।`, `—`, `–`).
3. **Legacy Address Backward Compatibility:**
   - Addresses without `__BDMETA__` are validated up to 500 characters using `cleanText(rawAddress, 500, true)`.
4. **Checkout Guest Address Support:**
   - `validateCheckout()` in `src/lib/validation.ts` now accepts smart packed addresses in `guestAddress`.
5. **Instant Auto-Select in Checkout (`src/components/pages/CheckoutPage.tsx`):**
   - When a customer adds or edits an address during checkout, the newly saved address is instantly auto-selected (`setSelectedAddressId(savedAddress.id)`), closing the form and eliminating the "Please select delivery address" friction.

---

## 3. Issue 2: BulkSMSBD Phone OTP Verification Integration

### Architecture & Contract
- **Provider Endpoint:** `https://bulksmsbd.net/api/smsapi`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`, `Accept: application/json`
- **Payload:**
  ```json
  {
    "api_key": "BULKSMSBD_API_KEY",
    "type": "text",
    "number": "8801XXXXXXXXX",
    "senderid": "BULKSMSBD_SENDER_ID",
    "message": "Your Khati Khadyo verification code is XXXXXX."
  }
  ```
- **Success Criteria:** BulkSMSBD returns `response_code: 202` on successful submission.

### Phone Number Normalization (`normalizeBulkSmsPhone`)
All Bangladeshi mobile number formats are safely converted to the provider's standard 13-digit format:
- `01712345678` → `8801712345678`
- `+8801712345678` → `8801712345678`
- `8801712345678` → `8801712345678`
Invalid formats (non-digits, lengths other than 11 digits, invalid operators) return `null`.

### Security Invariants & Environment Protection
1. **Credentials Never Committed or Leaked:**
   - Server-only adapter (`src/lib/bulksmsbd.ts`).
   - `.env.example` updated with placeholders:
     ```env
     BULKSMSBD_API_KEY=""
     BULKSMSBD_SENDER_ID=""
     ```
   - Existing `.env` file was never touched, modified, or staged.
2. **Automated Test Safeguard:**
   - In automated test environments (`NODE_ENV === 'test'`), `sendBulkSms` automatically routes to a mock transport (`setBulkSmsMockTransport`), guaranteeing zero real SMS messages are ever sent during tests.
3. **Secure OTP Challenges:**
   - OTP codes are 6-digit numeric strings with keyed cryptographic hashes in the `OtpChallenge` table.
   - Rate limiting: 60-second cooldown per phone number (`OtpCooldownError`).
   - Maximum attempt counter: Locked after 5 incorrect attempts (`MAX_OTP_ATTEMPTS`).
   - 5-minute expiration window (`OTP_TTL_MS = 5 * 60 * 1000`).
   - Single-use consumption: `consumedAt` timestamp set upon successful verification.

### Account Rules & Checkout Enforcement
1. **Phone-Based Registration:**
   - Sets `isVerified: false`.
   - Automatically issues the initial 6-digit verification code.
2. **Email-Based Registration:**
   - Customer can browse, add to cart, and view products.
   - To place an order, phone number must be added and verified.
   - Once verified, no repeated OTP is required unless the customer changes their phone number.
3. **Checkout Gate:**
   - In `src/app/api/orders/route.ts`, if a logged-in user attempts to place an order without a verified phone (`!customer.phone || !customer.isVerified`), the API rejects the request with HTTP 403:
     ```json
     {
       "success": false,
       "code": "PHONE_UNVERIFIED",
       "error": "অর্ডার নিশ্চিত করতে আপনার ফোন নম্বর ভেরিফাই করা আবশ্যক। অনুগ্রহ করে আপনার মোবাইল নম্বরে পাঠানো ওটিপি কোড দিয়ে ভেরিফিকেশন সম্পন্ন করুন।"
     }
     ```
4. **Interactive Checkout UI:**
   - Step 1 of `src/components/pages/CheckoutPage.tsx` displays a prominent Bengali phone verification card if `isAuthenticated && (!user.isVerified || !user.phone)`.
   - Allows sending/resending OTP with a 60-second countdown timer.
   - 6-digit verification code input with immediate feedback and instant state update (`setUser({ ...user, isVerified: true })`).

---

## 4. Test Verification Results

All 53 unit and integration tests across the test suite execute and pass cleanly:

```text
✔ tests/bulksmsbd-otp.test.mjs
  ✔ 1. normalizeBulkSmsPhone normalizes all Bangladeshi phone formats to 8801XXXXXXXXX
  ✔ 2. sendBulkSms routes to mock transport in test mode and preserves contract
  ✔ 3. OTP lifecycle: issue, cooldown enforcement, attempt tracking, and consumption
  ✔ 4. Order placement blocked for unverified logged-in customer and allowed once verified

✔ tests/smart-address-validation.test.mjs
  ✔ 1. Smart address pack and unpack round-trip preserves all Bangladesh fields
  ✔ 2. validateAddressParts accepts and validates a full Bangladesh Smart Address
  ✔ 3. validateAddressParts accepts legacy plain string addresses with Bengali text and punctuation
  ✔ 4. validateAddressParts rejects malformed or corrupted metadata JSON
  ✔ 5. validateAddressParts sanitizes and strips unauthorized properties injected into metadata
  ✔ 6. validateCheckout allows guest orders with smart packed addresses

✔ tests/cart-checkout-order-routes.test.mjs (11 tests passed)
✔ tests/catalog-routes-seo.test.mjs (7 tests passed)
✔ tests/handler-sslcommerz-callbacks.integration.test.mjs (5 tests passed)
✔ tests/payment-inventory.test.mjs (7 tests passed)
✔ tests/prisma-payment-inventory.integration.test.mjs (5 tests passed)
✔ tests/safe-upsert-admin.test.mjs (8 tests passed)

Total: 53 passed, 0 failed, 0 skipped
```

- `npx tsc --noEmit` passed with 0 errors.
- `npm run lint` (`eslint .`) passed with 0 errors and 0 warnings.

---

## 5. Modified Files Summary

| File | Status | Description |
|---|---|---|
| `src/lib/bulksmsbd.ts` | Created | Server-to-server BulkSMSBD adapter with normalization, error handling, and test mock transport |
| `src/lib/otp.ts` | Modified | Integrated BulkSMSBD adapter, cooldown class fix, error handling |
| `src/lib/validation.ts` | Modified | Smart address metadata validation, Unicode numeral & Bengali regex expansion |
| `src/app/api/addresses/[id]/route.ts` | Modified | Added `validateAddressParts` check to address update endpoint |
| `src/app/api/auth/register/route.ts` | Modified | Enforced `isVerified: false` and auto-issued initial phone verification code |
| `src/app/api/auth/verify-phone/send/route.ts` | Modified | Added support for adding/updating phone before sending OTP |
| `src/app/api/auth/verify-phone/route.ts` | Modified | Updates `isVerified: true` and syncs phone on user upon successful verification |
| `src/app/api/orders/route.ts` | Modified | Added HTTP 403 `PHONE_UNVERIFIED` check for unverified customer orders |
| `src/components/pages/CheckoutPage.tsx` | Modified | Added Bengali OTP verification banner/form and validation in checkout |
| `.env.example` | Modified | Added `BULKSMSBD_API_KEY` and `BULKSMSBD_SENDER_ID` placeholders |
| `tests/smart-address-validation.test.mjs` | Created | 6 automated tests for smart address validation, metadata, and Unicode |
| `tests/bulksmsbd-otp.test.mjs` | Created | 4 automated tests for BulkSMSBD normalization, contract, OTP lifecycle, and order blocking |
