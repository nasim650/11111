# 🛡️ Phase 4A: BulkSMSBD OTP, Account Verification & Password Recovery Security Blueprint

**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Branch:** `phase-1b-implementation`  
**Execution Date:** 2026-11-04  
**Status:** Complete Security & Architectural Blueprint (Analysis & Design Only — Zero Implementation / Zero Mutations)  

---

## 1. Skills Actually Used

In compliance with project auditing rules, each skill evaluated during this phase is documented below. Installed skills were applied directly to verify codebase contracts and formulate architectural designs; skills not installed are designated as **Not Available**.

| Skill ID | Status | Purpose & Contribution | Files & Sections Audited / Designed |
| :--- | :---: | :--- | :--- |
| `backend-architect` | **Active** | Architected decoupled auth flows, gateway timeouts, idempotent retry semantics, and dual-channel verification boundaries. | Account lifecycle, BulkSMSBD adapter contract, API state machines |
| `nodejs-backend-patterns` | **Active** | Defined Node.js cryptographic primitives (`crypto.randomInt`, `crypto.timingSafeEqual`, `crypto.createHmac`), unref timers, and error normalization. | OTP generation, hashing, timing-safe matching, timeout wrappers |
| `api-security-best-practices` | **Active** | Designed anti-enumeration responses, zero plaintext OTP storage, session invalidation on password change, and rate-limiting quotas. | Anti-enumeration policy, credential security, token contracts |
| `threat-modeling-expert` | **Active** | Applied STRIDE analysis across OTP generation, SMS transit, verification, phone mutation, and reset endpoints; built threat mitigation matrix. | Section 2 (STRIDE Threat Model & Attack Trees) |
| `database-architect` | **Active** | Audited PostgreSQL Prisma schema; planned non-destructive migration additions, index topology, and data retention/purge cron policies. | Section 6 (Database Schema & Migration Plan) |
| `prisma-expert` | **Active** | Evaluated existing `OtpChallenge`, `User`, and `AuditLog` models; drafted atomic transaction semantics for challenge consumption. | `prisma/schema.prisma`, atomic verification transactions |
| `testing-patterns` | **Active** | Designed 10-dimension automated test matrix covering race conditions, expired challenges, cooldowns, and isolation. | Section 7 (Phase 4B Test Plan Matrix) |
| `api-contract-testing` | **Active** | Defined strict JSON request/response schemas, HTTP status codes, and localized error message contracts. | Section 5 (Endpoint Contracts) |
| `dependency-analysis` | **Active** | Audited existing dependencies (`jose`, `bcryptjs`, `crypto`, `@prisma/client`, `ioredis`) to prevent bloated or unvetted external libraries. | `package.json`, auth utilities |
| `writing-guidelines` | **Active** | Authored comprehensive, technical, and actionable documentation following GitHub Flavored Markdown and project conventions. | Entire report |

---

## 2. STRIDE Threat Model & Risk Assessment

A thorough threat modeling exercise was conducted for the proposed BulkSMSBD OTP, phone verification, and password recovery workflows.

```
                             [ Untrusted Public Internet ]
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 [ Phone Signup ]                [ Email Signup ]
                         │                               │
                         ▼                               ▼
                  ┌─────────────┐                 ┌─────────────┐
                  │ 6-Digit OTP │                 │ Browse Only │
                  │  Challenge  │                 └──────┬──────┘
                  └──────┬──────┘                        │ First Checkout
                         ▼                               ▼
             ┌───────────────────────┐         ┌───────────────────┐
             │ Phone Verified Status │ ◄───────┤ Gate: Phone + OTP │
             └───────────┬───────────┘         └───────────────────┘
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
[ Order Placement ]            [ Password Recovery ]
  (COD / SSLCOMMERZ)             (SMS OTP / Email Link)
```

| STRIDE Category | Concrete Threat / Attack Vector | Severity | Architectural Mitigation Design |
| :--- | :--- | :---: | :--- |
| **Spoofing (Identity)** | Malicious actor guesses 6-digit OTP to hijack customer account or verify an unowned phone number. | **Critical** | Cryptographically secure uniform PRNG (`crypto.randomInt`); maximum 3 to 5 failed attempts locks challenge permanently; 5-minute TTL. |
| **Tampering (Data)** | Attacker alters phone number in flight or replays a previously consumed OTP code. | **High** | HMAC-SHA256 signature binding `identifier + purpose + code` with server-side `OTP_SECRET`; atomic database update (`consumedAt = now()`) prevents replay. |
| **Repudiation** | Customer places an order on COD and later claims "I never verified that phone or placed that order." | **Medium** | Immutable `AuditLog` entry recorded upon successful OTP verification with hashed challenge ID, IP, user agent, and timestamp. |
| **Information Disclosure** | Attacker probes `/api/auth/forgot-password` or `/api/auth/register` to enumerate valid phone numbers of customers/admins. | **High** | Uniform HTTP response (`200 OK: { success: true, data: { sent: true } }`) with constant-time response delay whether phone exists or not. |
| **Denial of Service (DoS & Toll Fraud)** | Malicious actor scripts mass OTP requests to exhaust BulkSMSBD account balance ("SMS bombing"). | **Critical** | Multi-tier rate limiting via Redis: 1 request per 60s per phone, 5 per hour per phone, 10 per hour per IP. Cloudflare/Turnstile integration readiness. |
| **Elevation of Privilege** | Attacker uses a customer phone reset flow to reset an `admin` or `manager` account. | **Critical** | Administrative roles (`admin`, `manager`) require mandatory multi-factor validation and cannot be reset via plain customer SMS OTP without separate admin recovery token. |

---

## 3. Account Lifecycle & Verification Rules Architecture

### 3.1 Rule 1: Phone-First Registration
1. **Inputs:** `name`, `phone` (Bangladeshi mobile), `password`.
2. **Phone Normalization:**
   - Raw input (e.g., `01711-000000`, `+8801711000000`, `8801711000000`) is normalized to canonical local `01XXXXXXXXX` for storage/login, and international `8801XXXXXXXXX` for BulkSMSBD dispatch.
3. **Account Creation State:**
   - A `User` record is created with `isVerified = false` and `phoneVerifiedAt = null`.
   - An `OtpChallenge` is generated and dispatched via BulkSMSBD.
4. **Session Boundary:**
   - The user cannot log in or checkout until OTP is validated.
   - Upon successful verification: `isVerified = true`, `phoneVerifiedAt = now()`, and authenticated JWT session cookie is issued.

### 3.2 Rule 2: Email Registration & The Checkout Verification Gate
1. **Inputs:** `email`, `password`, optional `name`.
2. **Account Creation State:**
   - User account created with `isVerified = false`, `phone = null`.
   - User is allowed to log in, browse catalog, save wishlist, and configure cart.
3. **Mandatory Checkout Phone Gate:**
   - When proceeding to `/checkout` or submitting `POST /api/orders`:
     - If `user.phone == null` or `user.isVerified == false`:
       - Checkout API rejects order submission with HTTP 403:
         ```json
         {
           "success": false,
           "code": "PHONE_VERIFICATION_REQUIRED",
           "error": "অর্ডার সম্পন্ন করতে অনুগ্রহ করে আপনার মোবাইল নম্বর ভেরিফাই করুন।"
         }
         ```
     - UI presents a clean modal/step: "Add & Verify Mobile Number".
     - BulkSMSBD OTP is sent to the provided phone; upon verification, `user.phone` is attached, `isVerified = true`, and checkout resumes seamlessly.

### 3.3 Rule 3: Phone Number Mutation & Audit History
1. Once a phone number is verified, no repetitive OTPs are required for future logins or orders.
2. If a customer wishes to change their registered phone number in Profile:
   - User must enter current password to authorize modification.
   - New phone number must not belong to another active user.
   - BulkSMSBD OTP challenge is dispatched to the **new** phone number.
   - The old phone remains active until the new phone OTP is successfully confirmed.
   - Upon successful confirmation:
     - Old phone is replaced: `user.phone = newPhone`, `phoneVerifiedAt = now()`.
     - An immutable `AuditLog` entry is written:
       ```json
       {
         "action": "USER_PHONE_CHANGED",
         "module": "account",
         "referenceId": "user_cuid",
         "previousData": "{\"maskedPhone\":\"017****0001\"}",
         "newData": "{\"maskedPhone\":\"018****0002\",\"verifiedAt\":\"2026-11-04T10:00:00Z\"}"
       }
       ```
     - User session version is incremented (`sessionVersion += 1`) to terminate any stale sessions on untrusted devices.

### 3.4 Rule 4: Dual-Channel Password Recovery (Phone SMS vs Email Token)
When a user clicks "Forgot Password", they enter their identifier:
1. **If Phone Number is provided:**
   - System checks if an account exists with this phone.
   - If user exists and phone is verified:
     - Dispatches 6-digit OTP via BulkSMSBD with `purpose: 'password_reset'`.
     - Resend cooldown: 60 seconds. Expiry: 5 minutes.
   - If user does not exist: returns identical success message (anti-enumeration).
   - User submits `phone + code + newPassword`:
     - Code is validated against `OtpChallenge`.
     - Upon success: `password` is hashed (`bcrypt` 12 rounds), `sessionVersion` incremented (all devices logged out), and challenge marked `consumedAt = now()`.
2. **If Email Address is provided:**
   - System checks if an account exists with this email.
   - If user exists:
     - Generates cryptographically secure 256-bit random URL token (`crypto.randomBytes(32).toString('hex')`).
     - Token hash (`SHA-256`) stored in database with 15-minute expiry.
     - Transactional email dispatched with link: `https://khatikhadyo.com/reset-password?token=...`.
   - If user does not exist: returns identical success message.
   - User submits token + new password:
     - Token verified and marked consumed; password updated; `sessionVersion` incremented.

---

## 4. BulkSMSBD Provider Integration Architecture

### 4.1 BulkSMSBD API Specifications
BulkSMSBD (`bulksmsbd.com` / `api.bulksmsbd.net`) provides a high-throughput HTTP POST interface for Bangladesh mobile operators (Grameenphone, Banglalink, Robi, Airtel, Teletalk).

- **API Endpoint:** `https://bulksmsbd.net/api/smsapi`
- **HTTP Method:** `POST`
- **Content-Type:** `application/x-www-form-urlencoded` or `application/json`
- **Request Parameters:**
  | Field | Type | Description | Security Rule |
  | :--- | :---: | :--- | :--- |
  | `api_key` | String | Secret API key generated in BulkSMSBD portal. | Stored strictly in `BULKSMSBD_API_KEY` env; never in code or client. |
  | `type` | String | Must be `"text"`. | Constant value. |
  | `number` | String | 13-digit recipient: `8801XXXXXXXXX`. | Normalized from local `01XXXXXXXXX`. |
  | `senderid` | String | Approved Masking or Non-Masking Sender ID (e.g., `88096...`). | Stored in `BULKSMSBD_SENDER_ID` env. |
  | `message` | String | UTF-8 / English transactional text. | Contains OTP; never logged to console, database, or disk. |

### 4.2 BulkSMSBD Response Contract
BulkSMSBD returns standard JSON status structures:

```json
// Successful Dispatch:
{
  "response_code": 202,
  "message_id": 10842918,
  "success_message": "SMS Submitted Successfully"
}

// Error Conditions:
{ "response_code": 1002, "error_message": "Sender Id is not Correct / Approved" }
{ "response_code": 1003, "error_message": "API Key not correct" }
{ "response_code": 1007, "error_message": "Balance Insufficient" }
{ "response_code": 1011, "error_message": "Invalid Phone Number" }
```

### 4.3 Server-Side Adapter Specification (`src/lib/bulksmsbd.ts`)

```typescript
export interface BulkSMSBDConfig {
  apiKey: string
  senderId: string
  apiUrl: string
}

export interface BulkSMSBDResponse {
  success: boolean
  messageId?: number
  errorCode?: number
  errorMessage?: string
}

/**
 * Server-side transactional SMS dispatcher for BulkSMSBD.
 * Security guarantees:
 * 1. AbortController timeout (5000ms max).
 * 2. Zero logging of message payload or API key.
 * 3. Strict phone normalization to 8801XXXXXXXXX.
 */
export async function sendBulkSMS(
  phone: string,
  message: string,
  config: BulkSMSBDConfig
): Promise<BulkSMSBDResponse> {
  const normalizedRecipient = toBulkSmsRecipient(phone)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)

  try {
    const formData = new URLSearchParams()
    formData.append('api_key', config.apiKey)
    formData.append('type', 'text')
    formData.append('number', normalizedRecipient)
    formData.append('senderid', config.senderId)
    formData.append('message', message)

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: controller.signal,
    })

    if (!response.ok) {
      return { success: false, errorMessage: `HTTP ${response.status}` }
    }

    const data = await response.json()
    if (data.response_code === 202) {
      return { success: true, messageId: data.message_id }
    }

    return {
      success: false,
      errorCode: data.response_code,
      errorMessage: data.error_message || 'BulkSMSBD rejected transmission',
    }
  } catch (error: any) {
    const isTimeout = error.name === 'AbortError'
    return {
      success: false,
      errorMessage: isTimeout ? 'Gateway timeout (5000ms exceeded)' : 'Network unreachable',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
```

---

## 5. Cryptographic & Security Safeguards

### 5.1 Cryptographically Secure OTP Generation
- **Method:** `crypto.randomInt(100_000, 1_000_000).toString()`
- **Guarantees:** Uniform integer distribution between `100000` and `999999`. Eliminates PRNG predictability vulnerabilities found in `Math.random()`.

### 5.2 Zero Plaintext OTP Storage & HMAC-SHA256
- **Storage Rule:** Plaintext OTP is **never** written to the database, logs, or persistent cache.
- **HMAC Construction:**
  $$\text{codeHash} = \text{HMAC-SHA256}(\text{key} = \text{OTP\_SECRET}, \text{data} = \text{normalizedPhone} + \text{":"} + \text{purpose} + \text{":"} + \text{code})$$
- **Comparison:** Timing-safe buffer comparison (`crypto.timingSafeEqual`) prevents timing analysis attacks.

### 5.3 Distributed Redis Rate Limiting & Cooldown Architecture
To defend against SMS toll fraud and brute-force guessing, three layers of limits are enforced via Redis:

```
[ Incoming Request ]
        │
        ├─► 1. Per-Phone Cooldown: 1 SMS per 60s (Redis key: `cooldown:otp:<phone>`)
        ├─► 2. Per-Phone Quota: 5 SMS per hour (Redis key: `quota:phone:<phone>`)
        ├─► 3. Per-IP Quota: 10 SMS per hour (Redis key: `quota:ip:<ip>`)
        └─► 4. Verification Brute-Force Lock: Max 5 wrong attempts per challenge
```

- **Resend Cooldown:** 60 seconds strict. Requesting a code at $t = 30\text{s}$ returns HTTP 429 with `Retry-After: 30`.
- **Challenge Lifetime (TTL):** 300 seconds (5 minutes). Expired challenges cannot be validated.
- **Attempt Lockout:** Each invalid entry increments `attempts`. Once `attempts >= 5`, the challenge is instantly locked (`consumedAt = now()`), forcing the user to request a fresh challenge.

### 5.4 Anti-Enumeration Design
- Endpoints for `forgot-password` and `verify-phone/send` must return identical response payloads and HTTP status codes:
  ```json
  { "success": true, "data": { "sent": true, "expiresInSeconds": 300 } }
  ```
- If the phone does not exist in the database, the server runs a dummy hash computation (`crypto.createHmac`) before responding, matching response latency to prevent timing enumeration.

### 5.5 Bengali User-Facing Error Messages Matrix

| Code / Condition | HTTP Status | English Developer Error | User-Facing Bengali Message |
| :--- | :---: | :--- | :--- |
| `INVALID_PHONE` | 400 | Invalid Bangladeshi mobile format | সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01711XXXXXX)। |
| `OTP_COOLDOWN` | 429 | Resend cooldown active | অনুগ্রহ করে {seconds} সেকেন্ড অপেক্ষা করে আবার কোড চান। |
| `OTP_EXPIRED` | 400 | Challenge expired or not found | ভেরিফিকেশন কোডের মেয়াদ শেষ হয়ে গেছে। অনুগ্রহ করে নতুন কোড চান। |
| `OTP_INVALID` | 400 | Hash mismatch | ভুল কোড দিয়েছেন। অনুগ্রহ করে সঠিক ৬ ডিজিটের কোড দিন। |
| `MAX_ATTEMPTS` | 400 | Max verification attempts exceeded | অতিরিক্ত ভুল চেষ্টার কারণে কোডটি বাতিল করা হয়েছে। নতুন কোড চান। |
| `RATE_LIMITED` | 429 | Hourly quota exceeded | এই নম্বর বা ডিভাইস থেকে অনেকবার চেষ্টা করা হয়েছে। ১ ঘণ্টা পর চেষ্টা করুন। |
| `GATEWAY_ERROR` | 503 | SMS provider failure | সাময়িকভাবে SMS পাঠাতে সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন। |

---

## 6. Database & Migration Architecture

### 6.1 Audit of Existing Prisma Schema
The existing schema was audited for Phase 4 compatibility:

1. **`OtpChallenge` Model (Already present in `prisma/schema.prisma`):**
   ```prisma
   model OtpChallenge {
     id         String    @id @default(cuid())
     identifier String
     purpose    String
     codeHash   String
     attempts   Int       @default(0)
     sendCount  Int       @default(1)
     expiresAt  DateTime
     consumedAt DateTime?
     createdAt  DateTime  @default(now())
     updatedAt  DateTime  @updatedAt

     @@index([identifier, purpose, expiresAt])
     @@index([expiresAt])
   }
   ```
   - **Reuse Verdict:** Fully reusable for BulkSMSBD SMS OTP challenges (`purpose = 'phone_verification' | 'password_reset'`).

2. **`User` Model:**
   - Currently has: `phone String? @unique`, `email String? @unique`, `isVerified Boolean @default(false)`, `sessionVersion Int @default(0)`.
   - **Gap Identified:** Lacks explicit timestamps for when phone or email verification occurred.
   - **Recommended Additions for Phase 4B Migration:**
     ```prisma
     phoneVerifiedAt DateTime?
     emailVerifiedAt DateTime?
     ```

3. **`AuditLog` Model (Already present):**
   - Fully supports recording phone modification and security events:
     - `action: 'PHONE_VERIFIED' | 'PHONE_CHANGED' | 'PASSWORD_RESET_SMS' | 'PASSWORD_RESET_EMAIL'`
     - `module: 'auth'`
     - `referenceId: userId`

4. **Retention & Purge Policy:**
   - Consumed or expired `OtpChallenge` records older than 7 days should be automatically purged via a periodic cron worker (`DELETE FROM "OtpChallenge" WHERE "expiresAt" < NOW() - INTERVAL '7 days'`).

---

## 7. Endpoint Contracts & Specifications

### 7.1 `POST /api/auth/otp/send`
- **Purpose:** Dispatches an OTP challenge to a phone number.
- **Request Body:**
  ```json
  {
    "phone": "01711000000",
    "purpose": "phone_verification" // or "password_reset"
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "data": { "sent": true, "expiresInSeconds": 300, "cooldownSeconds": 60 } }`
  - `429 Too Many Requests`: `{ "success": false, "error": "অনুগ্রহ করে ৪৫ সেকেন্ড অপেক্ষা করে আবার কোড চান।" }`

### 7.2 `POST /api/auth/otp/verify`
- **Purpose:** Validates the OTP challenge.
- **Request Body:**
  ```json
  {
    "phone": "01711000000",
    "purpose": "phone_verification",
    "code": "582914"
  }
  ```
- **Responses:**
  - `200 OK`: `{ "success": true, "data": { "verified": true } }`
  - `400 Bad Request`: `{ "success": false, "error": "ভুল কোড দিয়েছেন। সঠিক কোড লিখুন।" }`

### 7.3 `POST /api/auth/forgot-password`
- **Purpose:** Initiates password recovery via SMS or Email.
- **Request Body:**
  ```json
  {
    "identifier": "01711000000" // or "customer@example.com"
  }
  ```
- **Response:**
  - Always `200 OK`: `{ "success": true, "data": { "channel": "sms", "sent": true, "expiresInSeconds": 300 } }`

---

## 8. Implementation Test Matrix for Phase 4B

The following 10 verification dimensions must be covered by automated tests before Phase 4 is considered complete:

| # | Dimension | Test Scenario | Expected Outcome |
| :---: | :--- | :--- | :--- |
| **1** | **OTP Generation & Send** | Dispatch OTP to valid `017...` phone. | `OtpChallenge` created; code is 6 digits; hashed with HMAC; BulkSMSBD invoked with `88017...`. |
| **2** | **Resend Cooldown** | Request a second OTP 15s after the first. | HTTP 429 returned with `Retry-After: 45`; BulkSMSBD is **not** called. |
| **3** | **Valid OTP Verification** | Submit correct 6-digit code within 5 minutes. | Challenge marked `consumedAt = now()`; returns 200 OK; phone marked verified. |
| **4** | **Invalid OTP & Attempt Lock** | Submit wrong code 5 consecutive times. | First 4 attempts return 400 with attempts left; 5th attempt invalidates challenge permanently. |
| **5** | **Expired OTP Rejection** | Attempt verification at $t = 301\text{s}$. | Rejected with 400 Expired; no user status mutation. |
| **6** | **Replay Protection** | Re-submit previously consumed code. | Rejected with 400 "Code already used". |
| **7** | **Concurrent Verification Race** | Two simultaneous verification requests with same valid code. | Exactly one transaction succeeds; second is rejected (zero double-consumption). |
| **8** | **Phone Mutation & Audit** | User changes phone from A to B. | Old phone active until B verified; B verified ➔ old phone replaced; `AuditLog` created; sessions rotated. |
| **9** | **Email User Checkout Gate** | Unverified email user attempts `POST /api/orders`. | Rejected with HTTP 403 `PHONE_VERIFICATION_REQUIRED`; order and inventory untouched. |
| **10** | **Password Reset Session Revocation** | Reset password via valid SMS OTP. | New password hashed; all prior JWT tokens immediately invalidated via `sessionVersion += 1`. |

---

## 9. Prerequisites & Blocking Conditions Checklist

The implementation phase (Phase 4B) **must not be initiated** until the following items are addressed by the system owner:

### 9.1 Items Requiring System Owner Provisioning
- [ ] **BulkSMSBD Account:** Registered and active account on `bulksmsbd.com`.
- [ ] **BulkSMSBD API Key (`BULKSMSBD_API_KEY`):** Acquired from BulkSMSBD API Settings dashboard.
- [ ] **Approved Sender ID (`BULKSMSBD_SENDER_ID`):** BTRC-approved masking or non-masking sender ID (e.g., `88096...`).
- [ ] **SMS Credit Balance:** Sufficient account balance in BulkSMSBD for transactional SMS testing.
- [ ] **OTP Secret Key (`OTP_SECRET`):** A secure 32+ character random secret string (e.g., `openssl rand -base64 32`) configured in Vercel.

### 9.2 Infrastructure Blockers (Must Be Repaired First)
1. **Vercel Preview Environment Variables:**
   - As diagnosed in Phase 2C.1/Phase 3, `DATABASE_URL` and `JWT_SECRET` must be enabled with the **Preview** checkbox ticked in Vercel Project Settings.
   - Without this, Vercel Serverless Functions throw HTTP 500 crashes during runtime execution on preview URLs.
2. **BulkSMSBD Sandbox/Mocking Requirement for CI:**
   - In automated test runs (`npm test`), a mock BulkSMSBD adapter must be utilized so test suites do not expend real SMS credits or fail on network boundaries. Real dispatch will strictly occur in staging and production environments when valid credentials exist.
