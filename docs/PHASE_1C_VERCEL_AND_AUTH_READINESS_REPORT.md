# Phase 1C: Vercel Preview, Production Configuration Readiness & Admin Login Diagnosis Report

**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Date:** 2026-11-01  
**Branch:** `phase-1b-implementation`  
**Latest Commit:** `0613f69`  
**Engineer:** Antigravity AI Senior Architect  
**Status:** Complete Read-Only Audit & Diagnosis (Zero Deployments, Zero Database Mutations)

---

## 1. Vercel Preview Deployment Status

### 1.1 Git & Remote State
- **Current Branch:** `phase-1b-implementation`
- **Latest Commit:** `0613f69` (`fix(payment): phase 1b.1.1 eliminate database mutations in browser callbacks and add handler integration tests`)
- **Remote Synchronization:** Fully synchronized with GitHub remote `origin/phase-1b-implementation`.

### 1.2 Preview Deployment Verification
- **Local Vercel State:**
  - The repository does not contain a `.vercel/` project link file (properly ignored via `.gitignore`).
  - No active Vercel CLI session or `VERCEL_TOKEN` is configured in the local execution sandbox.
  - Per instructions, **no new Vercel project was created, and no live deployment was triggered**.
- **GitHub-to-Vercel Integration Analysis:**
  If the GitHub repository `nasim650/11111` is connected to a Vercel project with Git integration enabled:
  - **Automatic Preview Trigger:** Pushes to `phase-1b-implementation` normally trigger a Vercel Preview Deployment.
  - **Potential Causes if Preview is Not Generated:**
    1. **Project Connection Missing:** The GitHub repository may not yet be connected to a Vercel project in the Vercel dashboard.
    2. **Branch Ignored / Deployment Protection:** The Vercel project settings may restrict preview deployments to specific branch patterns, or Git Deployments may be paused.
    3. **Root Directory Misalignment:** If the Vercel project settings have a customized "Root Directory" (e.g. `1/` vs root `.`), the build runner cannot find `package.json`. In this repo, `package.json` resides at the root of the repository.
    4. **Build-Time Database Unreachability:** If Vercel executes `npm run build`, Next.js attempts static generation of dynamic routes like `sitemap.xml`. If `DATABASE_URL` is not populated in Vercel's **Preview Environment Variables**, the build will log `PrismaClientInitializationError` (as observed during local tests when outbound database connections are blocked).

---

## 2. Admin Login Diagnosis & Classification

The admin authentication pipeline in [`src/app/api/auth/login/route.ts`](file:///Users/nasimp/Desktop/11111/1/src/app/api/auth/login/route.ts) and [`src/lib/auth.ts`](file:///Users/nasimp/Desktop/11111/1/src/lib/auth.ts) was analyzed end-to-end. Potential error modes in the preview/production environment fall into five distinct categories:

### 2.1 Error Modes & Root Causes

| Error Code | Error Message / Symptoms | Root Cause in Preview/Production |
|---|---|---|
| **`401`** | `Invalid credentials` | 1. **No Admin User in DB:** The database has not been provisioned with an admin account.<br>2. **Incorrect Password:** Submitted password does not match the stored bcrypt hash.<br>3. **Inactive User:** Target user has `isActive: false` in the database. |
| **`403`** | `CSRF validation failed` | 1. **Origin Mismatch:** [`csrfGuard`](file:///Users/nasimp/Desktop/11111/1/src/lib/security.ts#L26) checks `originUrl.host === request.headers.get('host')`. In Vercel preview environments, accessing the API via cross-domain tools, mismatched reverse proxies, or external testing harnesses triggers 403.<br>2. **Missing Host/Origin Header:** Automated clients omitting the `Origin` header during unsafe POST requests. |
| **`429`** | `Too many requests. Please try again later.` | **Rate Limiter Triggered:** [`rateLimitOrResponse`](file:///Users/nasimp/Desktop/11111/1/src/lib/security.ts#L7) enforces a strict threshold of **5 login attempts per IP per minute**. Consecutive failed attempts quickly exhaust this window. |
| **`500`** | `Unable to sign you in right now. Please try again later.` | 1. **Missing or Weak JWT Secret:** [`src/lib/auth.ts`](file:///Users/nasimp/Desktop/11111/1/src/lib/auth.ts#L9) explicitly throws `Error('JWT signing is not configured')` if `JWT_SECRET` is absent or **less than 32 characters**.<br>2. **Database Connection Failure:** If `DATABASE_URL` is missing, misconfigured, or the remote PostgreSQL/Neon database instance is paused, `db.user.findFirst` throws a connection exception.<br>3. **Runtime Crash:** Any unhandled exception during password verification or token generation. |

### 2.2 Production Seeding & Data Safety Warning
- **`prisma/seed.ts` MUST NOT be run in Preview or Production:**
  In Phase 1A, safety guards were added to [`prisma/seed.ts`](file:///Users/nasimp/Desktop/11111/1/prisma/seed.ts#L12) to block execution in production (`isProduction && ALLOW_PRODUCTION_SEED !== 'true'`).
  - Running `seed.ts` executes `prisma.order.deleteMany()`, `prisma.user.deleteMany()`, and `prisma.product.deleteMany()`.
  - It would obliterate existing product catalog, order history, and audit records.
  - It would attempt to create a default admin credential (`admin123`), creating an immediate security vulnerability.
- **Strict Compliance:** No seed script was executed, and no database mutation occurred.

### 2.3 Proposed Safe Admin Creation / Recovery Utility
To safely provision or recover an admin user without risking table truncation or data loss, we propose a dedicated standalone utility script:

**Proposed Script Concept (`scripts/safe-upsert-admin.ts`):**
1. **Interactive / Environment Parameters:** Accepts target admin email and secure password via environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) or interactive CLI prompt.
2. **Non-Destructive:** Does NOT call `deleteMany()` or touch any relational tables.
3. **Idempotent Upsert:**
   - Hashes password using bcrypt with 12 salt rounds (`hashPassword`).
   - Checks if user exists: if yes, updates `role: 'admin'`, `isActive: true`, and updates the password hash; if no, creates the user with `role: 'admin'`.
4. **Audit Logged:** Inserts an administrative audit log recording the account creation/recovery event.
5. **Enforcement:** **This script will NOT be executed without explicit written user approval.**

---

## 3. Vercel Environment Variable Audit

A comprehensive comparison between `.env.example`, `ENVIRONMENT.md`, `src/` runtime consumption, and the active `.env` was conducted. **In accordance with strict privacy instructions, no variable values or credentials are revealed.**

### 3.1 Core Variable Audit Matrix

| Variable Name | Required? | Present in `.env`? | Status / Length / Mismatch Notes |
|---|:---:|:---:|---|
| `DATABASE_URL` | **Yes** | **YES** | Configured. Points to remote PostgreSQL pooler. Must be set in Vercel Preview & Production. |
| `DIRECT_URL` | **Yes** | **YES** | Configured. Required by Prisma for direct schema migrations. |
| `JWT_SECRET` | **Yes** | **YES** | Configured. Verified length $\ge 32$ characters (meets security policy). |
| `OTP_SECRET` | **Conditional** | **NO** | **Missing from `.env`**. Required for SMS OTP phone verification & password resets. |
| `CRON_SECRET` | **Yes** | **NO** | **Missing from `.env` and `.env.example`**. Required to authenticate `/api/cron/expire-pending-orders`. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | **NO** | **Missing from `.env`**. In `.env.example`, but missing in local `.env`. Used for canonical URLs and payment redirects. |
| `APP_URL` | Optional | **NO** | Used as fallback if `NEXT_PUBLIC_APP_URL` is absent. |
| `SSLCOMMERZ_STORE_ID` | **Yes** (Online) | Present, Empty | Defined in `.env` but value is empty (`length: 0`). Online checkout blocked until configured. |
| `SSLCOMMERZ_STORE_PASSWORD` | **Yes** (Online) | Present, Empty | Defined in `.env` but value is empty (`length: 0`). |
| `SSLCOMMERZ_IS_LIVE` | **Yes** | **YES** | Configured. Defaults to `"false"` (Sandbox mode). |
| `SSLCOMMERZ_MODE` | Optional | **NO** | Legacy fallback for `SSLCOMMERZ_IS_LIVE`. Not needed if `SSLCOMMERZ_IS_LIVE` is present. |
| `SSLCOMMERZ_SUCCESS_URL` | Optional | Present, Empty | Runtime dynamically constructs `${baseUrl}/api/payments/sslcommerz/success` if empty. |
| `SSLCOMMERZ_FAIL_URL` | Optional | Present, Empty | Runtime dynamically constructs fallback. |
| `SSLCOMMERZ_CANCEL_URL` | Optional | Present, Empty | Runtime dynamically constructs fallback. |
| `SSLCOMMERZ_IPN_URL` | Optional | Present, Empty | Runtime dynamically constructs `${baseUrl}/api/payments/sslcommerz/ipn` if empty. |
| `REDIS_URL` | Optional | **NO** | Present in `.env.example`. Required for distributed multi-instance rate limiting on Vercel. In-memory fallback active. |
| `NEXTAUTH_SECRET` | Unused | **YES** | Present in `.env` & docs, but `next-auth` is **never imported in `src/`**. Legacy dead configuration. |

### 3.2 Configuration Mismatch Findings
1. **`CRON_SECRET` Undocumented in `.env.example`:** Phase 1B/1B.1 hardened the cron endpoint to require header authorization, but `.env.example` was never updated to reflect this requirement.
2. **`NEXT_PUBLIC_APP_URL` vs `NEXTAUTH_URL`:** `ENVIRONMENT.md` lists `NEXTAUTH_URL`, whereas application code in [`src/lib/sslcommerz.ts`](file:///Users/nasimp/Desktop/11111/1/src/lib/sslcommerz.ts#L128) actually reads `NEXT_PUBLIC_APP_URL` or `APP_URL`.
3. **Dead Dependency (`next-auth`):** `next-auth` is listed in `package.json` and `ENVIRONMENT.md`, but authentication is actually performed by custom JWT logic using `jose` and `JWT_SECRET`.

---

## 4. Payment Callback & SSLCOMMERZ URL Review

### 4.1 Preview Domain vs Production Custom Domain Dynamics
In [`src/lib/sslcommerz.ts`](file:///Users/nasimp/Desktop/11111/1/src/lib/sslcommerz.ts#L127-L134):
```typescript
export function getAppBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const host = request.headers.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}
```

- **In Vercel Preview Deployments:**
  - If `NEXT_PUBLIC_APP_URL` is left **unset** in the Vercel Preview environment, `getAppBaseUrl()` dynamically resolves the preview hostname via the `host` header (e.g. `https://khati-khadyo-git-phase-1b-....vercel.app`).
  - **Risk:** If `NEXT_PUBLIC_APP_URL` is hardcoded to `https://khatikhadyo.com` in Vercel's global settings, testing payments on a Preview deployment will erroneously redirect customers to the live production site upon callback.
  - **Recommendation:** Set `NEXT_PUBLIC_APP_URL` specifically for the **Production** environment in Vercel, leaving Preview to resolve dynamically.

- **SSLCOMMERZ Server-to-Server IPN Accessibility on Preview:**
  - When a transaction occurs, SSLCOMMERZ servers make a direct POST request to `IPN_URL`.
  - **Blocker on Vercel Preview:** Vercel Preview deployments typically have **Vercel Authentication (Deployment Protection)** enabled by default. External SSLCOMMERZ servers cannot bypass this authentication and will receive an HTTP 401/302, preventing IPN delivery.
  - **Recommendation:** Real end-to-end IPN testing with live SSLCOMMERZ servers should be conducted on staging/production where the IPN route is publicly accessible, or via a tunneling service (e.g. ngrok/Cloudflare Tunnel) that bypasses preview protection.

### 4.2 Non-Authoritative Browser Redirect Guarantee (Phase 1B.1.1 Preserved)
- The browser redirect URLs (`/api/payments/sslcommerz/success`, `/fail`, `/cancel`) remain **100% non-authoritative**.
- Even if a customer returns from SSLCOMMERZ to a Preview or Production domain, the browser callback cannot mutate order status, cannot release inventory, and cannot forge payment confirmation.
- Only the server-to-server IPN validates signatures, checks validation APIs, and finalizes payments.

### 4.3 HTTPS & Cron Authorization Requirements
1. **Public HTTPS:** SSLCOMMERZ strictly mandates HTTPS for all production callback and IPN URLs.
2. **Cron Authorization:**
   - The expiration cron (`/api/cron/expire-pending-orders`) rejects unauthenticated requests with HTTP 401.
   - Schedulers must provide either:
     - `Authorization: Bearer <CRON_SECRET>`
     - `x-cron-secret: <CRON_SECRET>`
   - Query-string tokens (`?secret=...`) are rejected to prevent log leakage.

---

## 5. Custom-Domain Email Readiness Checklist

The project currently has placeholder SMTP configuration keys in the `SiteConfig` database table (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_from`, `smtp_pass`), but **no active mail transport client (e.g. Resend, SendGrid, Amazon SES, or Nodemailer) is implemented in the application code**.

### Production-Ready Email Infrastructure Checklist:

```
[ ] 1. Domain & DNS Authority
    ├── Canonical Domain: khatikhadyo.com
    ├── Nameserver / DNS Management Access (Cloudflare, Namecheap, Route53, etc.)
    └── Target Transactional Sender: info@khatikhadyo.com (and/or noreply@khatikhadyo.com)

[ ] 2. Transactional Email Provider Selection (Pending Owner Decision)
    ├── Candidate Options: Resend, Postmark, SendGrid, Amazon SES, or Custom SMTP
    └── Account Provisioning & API Key Generation

[ ] 3. DNS Authentication & Deliverability Records
    ├── SPF Record (TXT): "v=spf1 include:<provider-spf> ~all"
    ├── DKIM Records (CNAME / TXT): Provider-generated cryptographic domain keys
    ├── DMARC Policy (TXT): "v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@khatikhadyo.com; pct=100"
    └── MX Records: Configured if receiving incoming emails at info@khatikhadyo.com

[ ] 4. Domain & Sender Identity Verification
    ├── Provider dashboard verification of khatikhadyo.com
    └── Verification of sender identity (info@khatikhadyo.com)

[ ] 5. Application Integration Use Cases
    ├── Customer Order Confirmation & Receipt (PDF attachment support)
    ├── Order Status Transition Notifications (shipped, out for delivery, cancelled)
    ├── Customer Password Reset via Secure Magic Link / Token (as alternative to SMS OTP)
    ├── Admin Notification on High-Value / Low-Stock Events
    └── Contact Form Inquiry Forwarding

[ ] 6. SMS Provider Decision (PENDING OWNER DECISION)
    └── Decision pending on Bangladeshi SMS Gateway provider (e.g. Greenweb, SSL Wireless, Banglalink, Twilio)
```

---

## 6. Verification Status of Current Branch

All automated quality gates were re-verified against branch `phase-1b-implementation` at commit `0613f69`:

| Verification Gate | Command | Result | Details |
|---|---|:---:|---|
| **Test Suite** | `npm test` | **PASS** | **17/17 passed** (5 handler integration + 7 unit + 5 Prisma concurrency tests). |
| **Linting** | `npm run lint` | **PASS** | 0 errors, 0 warnings across all files. |
| **TypeScript** | `npx tsc --noEmit` | **PASS** | 0 type errors; strict typing validated. |
| **Security Headers** | `npm run verify:headers` | **PASS** | Next.js 16 `src/proxy.ts` security headers (CSP, HSTS, X-Frame-Options) verified. |
| **Production Build** | `npm run build` | **PASS** | Standalone production bundle generated successfully. |

---

## 7. Status Summary Table

| Category | Component / Feature | Current Status | Notes / Requirements |
|---|---|:---:|---|
| **Code & Testing** | Phase 1B / 1B.1 / 1B.1.1 Implementation | `Ready` | 17/17 tests passing, zero regression, atomic state claims verified. |
| **Security** | Next.js 16 Security Headers (`src/proxy.ts`) | `Ready` | CSP, HSTS, X-Content-Type-Options, Referrer-Policy verified. |
| **Database** | Prisma Schema & SQL Migration | `Ready` | `20261101145600_add_order_reservation_fields` ready for `prisma migrate deploy`. |
| **Database** | Seed Script Safety (`prisma/seed.ts`) | `Ready` | Production wipeout blocked; destructive seeding disabled. |
| **Vercel Env** | `DATABASE_URL` & `DIRECT_URL` | `Needs Configuration` | Must be configured in Vercel environment settings for Neon PostgreSQL. |
| **Vercel Env** | `JWT_SECRET` | `Needs Configuration` | Must be configured in Vercel settings ($\ge 32$ characters). |
| **Vercel Env** | `CRON_SECRET` | `Needs Configuration` | Must be generated and set in Vercel settings and scheduler. |
| **Vercel Env** | `NEXT_PUBLIC_APP_URL` | `Needs Configuration` | Must be configured for production domain (`https://khatikhadyo.com`). |
| **Payment** | SSLCOMMERZ Credentials | `Needs Configuration` | `SSLCOMMERZ_STORE_ID` & `PASSWORD` must be set in Vercel. |
| **Payment** | SSLCOMMERZ IPN Preview Reachability | `Needs Configuration` | Preview deployment protection must allow IPN bypass or test on public domain. |
| **Auth** | Production Admin Account | `Needs Configuration` | Needs execution of safe upsert script (requires owner approval). |
| **Infrastructure** | Transactional Email Provider Selection | `Blocked by Owner Decision` | Owner must choose email provider (Resend, SES, SendGrid, etc.). |
| **Infrastructure** | DNS Records (SPF, DKIM, DMARC) | `Blocked by Owner Decision` | Owner must configure DNS records at domain registrar/DNS host. |
| **Auth** | SMS Gateway Provider Selection | `Blocked by Owner Decision` | Owner must choose BD SMS provider for phone OTP authentication. |
| **Deployment** | Vercel Live Production Merge / Deploy | `Blocked by Owner Decision` | Strictly blocked per project instructions. |

---

## 8. Safe Next Steps (Requiring Owner Approval)

The following actions are prepared but will **NOT** be executed without explicit authorization:

1. **Authorization to create safe admin user creation script (`scripts/safe-upsert-admin.ts`):**
   - Provide a safe, non-destructive script that can be run with custom credentials to create the first admin user in PostgreSQL.
2. **Authorization to update `.env.example`:**
   - Add `CRON_SECRET=""` and update documentation to remove legacy `next-auth` references.
3. **Owner decision on Email and SMS providers:**
   - Select transactional email service (e.g. Resend) for order confirmations and password resets.
   - Select SMS gateway provider for Bangladeshi phone OTP verification.
