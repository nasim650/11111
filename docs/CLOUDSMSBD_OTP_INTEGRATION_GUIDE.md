# 📱 Cloud SMS BD (`p1.cloudsmsbd.com`) OTP Integration Guide

## 1. Overview

Khati Khadyo uses server-side SMS OTP delivery for:
1. **Registered Customer Mobile Verification** (`/api/auth/verify-phone/send`, `/api/auth/verify-phone`)
2. **Guest Checkout Phone Verification** (`/api/auth/guest-phone/send`, `/api/auth/guest-phone/verify`)
3. **Customer Password Reset** (`/api/auth/forgot-password`, `/api/auth/reset-password`)

This integration introduces an official server-only adapter for **Cloud SMS BD** (`p1.cloudsmsbd.com`).

---

## 2. Security & Architectural Safeguards

- **Strict Server-Side Isolation:** Cloud SMS BD API calls are strictly made from Next.js server runtime (`src/lib/cloudsmsbd.ts`).
- **No Browser Exposure:** `CLOUDSMSBD_API_KEY` and `CLOUDSMSBD_SENDER_ID` are private server environment variables. Never use `NEXT_PUBLIC_` prefixes.
- **Provider Isolation (No Duplicate Fallbacks):** When `SMS_PROVIDER=cloudsmsbd`, the system strictly uses Cloud SMS BD. If delivery fails, it fails fast and will **never** automatically fall back to an alternate gateway, preventing duplicate OTP deliveries and confusion.
- **HMAC-SHA256 OTP Hashing:** Only cryptographically secure hashes are stored in the database. Raw 6-digit OTP codes are never persisted.
- **Safe Challenge Invalidation:** If an SMS request to Cloud SMS BD encounters an HTTP error, network timeout, or provider rejection, the associated database OTP challenge is **immediately invalidated/consumed** (`consumedAt != null`). An unsent code can never be verified.
- **Zero Secret & PII Leakage:**
  - Phone numbers are masked in logs (e.g. `88017****5678`).
  - Provider response error codes are mapped to sanitized Bengali messages.
  - Raw API keys, sender values, raw payloads, and balance amounts are never exposed to clients or server logs.
- **Resend Cooldown & Attempt Throttling:** 60-second resend cooldown and maximum 5 failed attempts before challenge invalidation.

---

## 3. Cloud SMS BD API Contract

- **Endpoint:** `https://p1.cloudsmsbd.com/api/sms` (customizable via `CLOUDSMSBD_API_URL`)
- **Method:** `POST`
- **Request Headers:**
  - `Content-Type: application/json`
  - `Accept: application/json, text/plain, */*`
- **Request Payload:**

```json
{
  "ApiKey": "<SECRET_KEY>",
  "SenderID": "<APPROVED_SENDER_ID>",
  "number": "8801XXXXXXXXX",
  "sms": "<MESSAGE_BODY>",
  "IsUnicode": 1 or 2
}
```

### Phone Normalization Rules
Any valid Bangladeshi phone input is normalized before delivery:
- `01XXXXXXXXX` $\rightarrow$ `8801XXXXXXXXX`
- `+8801XXXXXXXXX` $\rightarrow$ `8801XXXXXXXXX`
- `8801XXXXXXXXX` $\rightarrow$ `8801XXXXXXXXX`
- Non-Bangladeshi formats or invalid prefixes (e.g. `010`, `012`) are rejected.

### Character Encoding (`IsUnicode`) Rules
- **Bangla message:** `IsUnicode=1` (Unicode UCS-2 encoding)
- **English message:** `IsUnicode=2` (Standard GSM-7 text)

### Response Code Mapping
Documented provider success code is **`1`**. All other status codes are mapped to safe user-facing error messages:

| Provider Code | Technical Meaning | Safe User-Facing Message |
| :---: | :--- | :--- |
| **`1`** | SMS Submitted Successfully | *(Success response returned to client)* |
| **`2`** | Invalid ApiKey | `এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ (কনফিগারেশন ত্রুটি)` |
| **`3`** | Invalid SenderID | `এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ (সেন্ডার আইডি ত্রুটি)` |
| **`4`** | Invalid Mobile Number | `সঠিক বাংলাদেশি মোবাইল নম্বর দিন` |
| **`5`** | Empty SMS Text | `এসএমএস বার্তা ত্রুটিপূর্ণ` |
| **`6`** | Insufficient Credit/Balance | `এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ` *(balance hidden)* |
| **`7`** | Account Inactive / Blocked | `এসএমএস সেবা সাময়িকভাবে অনুপলব্ধ` |
| **`10`** | Invalid Unicode Parameter | `এসএমএস বার্তা এনকোডিং ত্রুটি` |
| **`11`** | Rate Limited / Sender Restricted | `অতিরিক্ত অনুরোধের কারণে এসএমএস সাময়িকভাবে স্থগিত। কিছুক্ষণ পর চেষ্টা করুন` |
| **`101`** | System Error / Gateway Down | `এসএমএস গেটওয়ে সাময়িক বিভ্রাটে রয়েছে` |
| **`405`** | Method Not Allowed | `অনুরোধ পদ্ধতি সমর্থিত নয়` |

---

## 4. Environment Variables for Vercel Dashboard

When activating Cloud SMS BD in production, configure the following variables in the **Vercel Project Settings $\rightarrow$ Environment Variables** (Production & Preview):

| Environment Variable | Required | Value / Description | Sensitive? |
| :--- | :---: | :--- | :---: |
| `SMS_PROVIDER` | **Yes** | Set to `cloudsmsbd` | No |
| `CLOUDSMSBD_API_KEY` | **Yes** | Your private Cloud SMS BD API key from `p1.cloudsmsbd.com` | **YES (Secret)** |
| `CLOUDSMSBD_SENDER_ID` | **Yes** | Your approved brand Masking / Sender ID (e.g. `KHATIKHADYO`) | No |
| `CLOUDSMSBD_API_URL` | No | Optional. Default: `https://p1.cloudsmsbd.com/api/sms` | No |
| `OTP_SECRET` | **Yes** | 32+ character random secret used for HMAC-SHA256 hashing | **YES (Secret)** |

> [!CAUTION]
> Never commit real values for `CLOUDSMSBD_API_KEY` or `OTP_SECRET` to Git repositories or share them in public communication channels.

---

## 5. Admin Safe Diagnostics

Authorized administrators (`role: 'admin'`) can verify SMS gateway connectivity and configuration state via:

```http
GET /api/admin/sms-diagnostics
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

**Response Format (200 OK):**
```json
{
  "success": true,
  "data": {
    "providerName": "cloudsmsbd",
    "providerConfigured": true,
    "senderIdConfigured": true,
    "otpSecretConfigured": true
  }
}
```

*This endpoint strictly outputs boolean status flags and never leaks raw keys, passwords, or hashes.*

---

## 6. Verification and Testing

All unit, integration, and flow tests use mock transports (`setCloudSmsMockTransport`) so no real SMS is sent during CI/CD:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Test suites (Unit & Integration)
npm test

# 4. Production build test
npm run build
```

---

## 7. Owner Production Activation Checklist

Before switching live traffic to Cloud SMS BD on Vercel:

- [ ] **1. Cloud SMS BD Balance & Sender ID Approval:**
  - Log into `https://p1.cloudsmsbd.com`.
  - Confirm your Sender ID (`SenderID`) is approved by BTRC.
  - Verify account balance/SMS units are loaded.
- [ ] **2. Vercel Environment Variables:**
  - Set `SMS_PROVIDER=cloudsmsbd`.
  - Set `CLOUDSMSBD_API_KEY=<your_api_key>`.
  - Set `CLOUDSMSBD_SENDER_ID=<approved_sender_id>`.
  - Ensure `OTP_SECRET` is set to a secure 32+ character secret.
- [ ] **3. Redeploy on Vercel:**
  - Trigger a redeployment on Vercel so the newly added environment variables take effect.
- [ ] **4. End-to-End Live Check:**
  - Perform one test guest checkout phone verification with an actual phone number.
  - Confirm receipt of OTP within 10-15 seconds.
  - Verify OTP code on checkout page.
