# Phase 7A — Production Launch Preflight
## Khati Khadyo (খাঁটি খাদ্য) · Bangladeshi Food E-Commerce

> **Document type:** Preflight / Audit Only  
> **Branch:** `phase-1b-implementation`  
> **Vercel project:** `11111`  
> **Target domain:** `khatikhadyo.com`  
> **Date:** 2026-11-13  
> **Status:** 🔴 NOT READY — blocking items remain (see §3, §4, §6)

---

> [!CAUTION]
> This document is **read-only audit output**. No DNS changes, no environment value changes, and no deployments are made by producing this document. Every action item is marked with the responsible party (Owner / Engineering) and must be executed deliberately and intentionally before go-live.

---

## Table of Contents

1. [Skills Actually Used](#1-skills-actually-used)
2. [Custom Domain Audit](#2-custom-domain-audit)
3. [Transactional Email Audit](#3-transactional-email-audit)
4. [Production Environment Variables Audit](#4-production-environment-variables-audit)
5. [Production Data Safety](#5-production-data-safety)
6. [SSLCOMMERZ Sandbox-to-Live Checklist](#6-sslcommerz-sandbox-to-live-checklist)
7. [Launch Test Checklist](#7-launch-test-checklist)
8. [Rollback Plan](#8-rollback-plan)
9. [Owner Must Configure · Engineering Must Complete · Ready to Launch](#9-final-sections)

---

## 1. Skills Actually Used

The following agent skills were applied during the production launch audit and documentation phase. Skills marked **Not Available** were referenced for guidance but could not be fully executed in the current environment context.

| # | Skill ID | Skill Name | Status | Applied To |
|---|----------|-----------|--------|-----------|
| 1 | `deploy-to-vercel` | Deploy to Vercel | **Active** | Vercel project structure review, preview deployment analysis, env var scope guidance |
| 2 | `vercel-cli-with-tokens` | Vercel CLI with Tokens | **Active** | Token-based env var audit, deployment protection status review |
| 3 | `api-security-best-practices` | API Security Best Practices | **Active** | Cron secret gap, coupon endpoint rate-limit finding, JWT/cookie audit |
| 4 | `secrets-management` | Secrets Management | **Active** | Missing secrets enumeration (`CRON_SECRET`, SMS vars, email vars), Vercel scope guidance |
| 5 | `backend-architect` | Backend Architect | **Active** | OTP delivery architecture, IPN verification review, database branching strategy |
| 6 | `testing-patterns` | Testing Patterns | **Active** | 43-test suite acknowledgement, Playwright E2E gap identification, launch test checklist design |
| 7 | `writing-guidelines` | Writing Guidelines | **Active** | Document structure, GFM formatting, checklist conventions, section ordering |

---

## 2. Custom Domain Audit

### 2.1 Domain Configuration

| Property | Value |
|----------|-------|
| Primary domain | `khatikhadyo.com` |
| www redirect | `www.khatikhadyo.com` → `khatikhadyo.com` (301) |
| SSL | Auto-provisioned by Vercel (Let's Encrypt) |
| Hardcoded fallback | `src/lib/site-url.ts` → `https://khatikhadyo.com` |
| `getBaseUrl()` production path | `NEXT_PUBLIC_APP_URL` env var (highest priority) |

### 2.2 Vercel Domain Setup Procedure

> [!IMPORTANT]
> These steps must be performed by the **domain owner** in the Vercel Dashboard. Do not perform these steps until all blocking env var items (§4) are resolved.

```
Step 1 — Add domain in Vercel Dashboard
  Project → Settings → Domains → Add "khatikhadyo.com"
  Vercel will show required DNS records.

Step 2 — Add www redirect
  Also add "www.khatikhadyo.com" in the same Domains panel.
  Set redirect: www.khatikhadyo.com → khatikhadyo.com (308 or 301).

Step 3 — Update DNS at your registrar
  Copy the A and CNAME records Vercel provides into your registrar's DNS panel.
  (See §2.3 for the full record table.)

Step 4 — Wait for propagation
  Typical propagation: 5–30 minutes with low TTL (300s).
  Use https://dnschecker.org to confirm globally.

Step 5 — SSL auto-provisioning
  Vercel automatically provisions a Let's Encrypt TLS certificate.
  Wait for the domain status to show "Valid Configuration" in the Dashboard.

Step 6 — Smoke test
  curl -I https://khatikhadyo.com
  curl -I https://www.khatikhadyo.com   # must 301/308 → khatikhadyo.com
```

### 2.3 Required DNS Records

> [!NOTE]
> MX, SPF, DKIM, and DMARC records are required only once you configure a transactional email provider (§3). The A/CNAME records are required immediately for the domain to resolve.

| Type | Host / Name | Value / Points To | TTL | Purpose |
|------|-------------|-------------------|-----|---------|
| `A` | `@` (apex) | `76.76.21.21` *(Vercel IP — confirm in dashboard)* | 300 | Apex domain → Vercel |
| `CNAME` | `www` | `cname.vercel-dns.com` | 300 | www subdomain → Vercel |
| `MX` | `@` | Provider MX records (e.g., `smtp.resend.com`) | 3600 | Inbound mail routing |
| `TXT` | `@` | `v=spf1 include:_spf.resend.com ~all` *(adjust per provider)* | 3600 | SPF — prevents spoofing |
| `TXT` | `resend._domainkey` *(adjust per provider)* | DKIM public key (from email provider dashboard) | 3600 | DKIM — email signing |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@khatikhadyo.com` | 3600 | DMARC — policy enforcement |

> [!WARNING]
> The exact Vercel IP (`76.76.21.21`) shown above is a common Vercel address. **Always copy the value directly from the Vercel Dashboard** when adding the domain — Vercel may assign different addresses per region or account tier.

### 2.4 Canonical URL Rules

The `getBaseUrl()` function in `src/lib/site-url.ts` resolves in this priority order:

```
1. NEXT_PUBLIC_APP_URL   → used if set (trim trailing slash)
2. VERCEL_URL            → used if set (auto-injected by Vercel, preview URLs)
3. NODE_ENV=production   → hardcoded https://khatikhadyo.com
4. fallback              → http://localhost:3000
```

For **Production scope** in Vercel, set:

```
NEXT_PUBLIC_APP_URL = https://khatikhadyo.com
```

This ensures sitemap.xml, Open Graph meta tags, canonical `<link>` tags, and JSON-LD `url` fields all resolve to the correct production domain.

For **Preview scope**, leave `NEXT_PUBLIC_APP_URL` unset so Vercel falls back to the auto-injected `VERCEL_URL`, which correctly returns the preview deployment URL.

For **Development scope**, leave `NEXT_PUBLIC_APP_URL` unset (or set to `http://localhost:3000`) so local development uses localhost.

### 2.5 SEO Impact Analysis

| Feature | Mechanism | Status with correct env var |
|---------|-----------|----------------------------|
| `sitemap.xml` | Uses `getBaseUrl()` for `<loc>` entries | ✅ Correct with `NEXT_PUBLIC_APP_URL=https://khatikhadyo.com` |
| Open Graph `og:url` | Uses `getBaseUrl()` | ✅ Correct |
| `<link rel="canonical">` | Uses `getBaseUrl()` | ✅ Correct |
| JSON-LD `url` field | Uses `getBaseUrl()` | ✅ Correct |
| `robots.txt` `Sitemap:` directive | Uses `getBaseUrl()` | ✅ Correct |
| SSLCOMMERZ callback URLs | Env vars — currently may point to preview | ⚠️ See warning below |

### 2.6 Warnings

> [!WARNING]
> **SSLCOMMERZ Callback URLs** — The env vars `SSLCOMMERZ_SUCCESS_URL`, `SSLCOMMERZ_FAIL_URL`, `SSLCOMMERZ_CANCEL_URL`, and `SSLCOMMERZ_IPN_URL` must be verified to point to `https://khatikhadyo.com/...` paths — **not** to any preview deployment URL (e.g., `11111-6yo386rj2-dorim.vercel.app`). If a customer pays via a preview deployment, the IPN callback will post to the wrong URL and payment confirmation will fail silently. Audit these values before enabling live mode.

> [!WARNING]
> **Vercel Preview Deployment Protection** — The preview deployment `11111-6yo386rj2-dorim.vercel.app` has Vercel Authentication enabled. This blocks anonymous HTTP access to all API endpoints, including SSLCOMMERZ IPN callbacks. If you test sandbox payments against the preview deployment, IPN verification will fail because SSLCOMMERZ cannot authenticate. The owner must either: (a) disable Deployment Protection for the preview environment in Vercel Dashboard → Settings → Deployment Protection, or (b) add a Protection Bypass Secret header and configure SSLCOMMERZ to send it. This must be resolved before any payment flow testing on preview.

---

## 3. Transactional Email Audit

### 3.1 Current State

> [!CAUTION]
> **No transactional email provider is configured.** The following env vars are entirely absent from `.env` and from Vercel: `EMAIL_FROM`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `SENDGRID_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. All email-dependent features are unavailable at launch unless this gap is closed.

| Component | Status |
|-----------|--------|
| Email provider SDK | ❌ Not installed |
| Email env vars | ❌ Not present in `.env` or Vercel |
| Order confirmation email | ❌ Template not built |
| Order status update email | ❌ Template not built |
| Password reset OTP via email | ❌ Not built (SMS-only) |
| Phone verification OTP via email | ❌ Not built (SMS-only) |
| SPF / DKIM / DMARC DNS records | ❌ Not configured |

### 3.2 Required Sender Identity

| Sender address | Use case |
|----------------|----------|
| `noreply@khatikhadyo.com` | Transactional outbound (orders, OTPs) |
| `info@khatikhadyo.com` | Customer-facing (optional reply-to) |
| `dmarc@khatikhadyo.com` | DMARC aggregate report mailbox |

> [!NOTE]
> Both `noreply@` and `info@` require the domain `khatikhadyo.com` to be verified with your email provider. Domain verification involves adding DNS TXT records (SPF, DKIM) which are only possible once you control the domain's DNS (§2).

### 3.3 Recommended Email Providers

| Provider | Why consider it | Pricing tier |
|----------|----------------|--------------|
| **Resend** (recommended) | Native Next.js SDK (`resend` npm package), React Email support, generous free tier (3,000 emails/mo), simple API key setup | Free → \$20/mo |
| **SendGrid** | Battle-tested, strong deliverability, robust template engine, more complex setup | Free (100/day) → usage-based |
| **AWS SES** | Lowest cost at scale (\$0.10/1,000), requires AWS account and more setup effort | \$0.10/1,000 emails |

**Recommended path:** Start with **Resend** for speed-to-market. It integrates in under an hour with Next.js App Router and supports React Email templates natively.

### 3.4 Required Environment Variables for Email

| Variable | Example value | Notes |
|----------|--------------|-------|
| `EMAIL_FROM` | `noreply@khatikhadyo.com` | The `From:` address used for all outbound emails |
| `EMAIL_PROVIDER` | `resend` | Allows future provider switching without code changes |
| `RESEND_API_KEY` | `re_...` | From Resend dashboard (keep secret — Production scope only) |

If using SendGrid instead:

| Variable | Example value |
|----------|--------------|
| `SENDGRID_API_KEY` | `SG....` |

### 3.5 Email Templates Required

The following email templates must be built before launch. None currently exist in the codebase.

| # | Template | Trigger | Priority |
|---|----------|---------|----------|
| 1 | **Order Confirmation** | After successful payment (SSLCommerz IPN) or COD order placement | 🔴 P0 — Required at launch |
| 2 | **Order Status Update** | When admin changes order status (confirmed → shipped → delivered) | 🔴 P0 — Required at launch |
| 3 | **Password Reset OTP** | When customer requests a password reset — email fallback | 🟡 P1 — Required if SMS unavailable |
| 4 | **Phone Verification OTP** | Alternative OTP delivery for customers without reliable SMS | 🟡 P1 — Required if SMS unavailable |

### 3.6 OTP Delivery Architecture — Current State

The OTP system in `src/lib/otp.ts` currently:

- Sends OTPs exclusively via **BulkSMSBD** (`SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`, `SMS_SENDER_ID`)
- Throws `OtpDeliveryUnavailableError` when `SMS_GATEWAY_URL` is not set
- Has **no email fallback path**

This means: if BulkSMSBD is unavailable or the SMS variables are missing, **all OTP-dependent flows fail completely** — including customer signup, phone verification, and potentially password reset. Email as a fallback delivery channel is a production reliability requirement.

### 3.7 DNS Records for Email (Add After Provider Selection)

Once an email provider is selected, the following DNS records must be added to your registrar:

```
# Example for Resend
TXT  @              "v=spf1 include:_spf.resend.com ~all"
TXT  resend._domainkey  "<DKIM public key from Resend dashboard>"
TXT  _dmarc         "v=DMARC1; p=quarantine; rua=mailto:dmarc@khatikhadyo.com; pct=100"
```

---

## 4. Production Environment Variables Audit

> [!IMPORTANT]
> All variables marked **MISSING** or **Wrong value** are **blocking** production launch. Variables marked **Present (verify value)** must have their production values confirmed in Vercel Dashboard before go-live.

### 4.1 Vercel Environment Scope Reference

Vercel supports three environment scopes. Each variable should be scoped appropriately:

| Scope | When active |
|-------|-------------|
| **Production** | Merged to production branch → deployed to `khatikhadyo.com` |
| **Preview** | All non-production Vercel deployments (PRs, preview URLs) |
| **Development** | `vercel env pull` for local development |

### 4.2 Complete Environment Variable Checklist

| Variable | Required? | Vercel Scope | Local `.env` Status | Action Required |
|----------|-----------|-------------|---------------------|-----------------|
| `DATABASE_URL` | ✅ Critical | Production + Preview | ✅ Present | Verify Production value points to **Neon production branch**, not dev branch |
| `DIRECT_URL` | ✅ Critical | Production + Preview | ✅ Present | Verify Production value points to Neon production branch (used by Prisma for migrations) |
| `JWT_SECRET` | ✅ Critical | All scopes | ✅ Present | Must be ≥ 32 characters; must be **unique per environment** — do not reuse dev secret in production |
| `OTP_SECRET` | ✅ Critical | All scopes | ✅ Present | Must be ≥ 32 characters; must be **different from `JWT_SECRET`** |
| `CRON_SECRET` | ✅ Critical | Production | ❌ **MISSING** | Generate a secure random string (≥ 32 chars) and add to Vercel Production scope immediately |
| `NEXT_PUBLIC_APP_URL` | ✅ Critical | Production only | ✅ Present locally | Production value must be exactly `https://khatikhadyo.com` (no trailing slash) |
| `REDIS_URL` | ✅ Critical | Production + Preview | ✅ Present | Required for distributed rate limiting; verify connection string is reachable from Vercel |
| `CLOUDINARY_CLOUD_NAME` | ✅ Required | All scopes | ✅ Present | Verify correct cloud name in production |
| `CLOUDINARY_API_KEY` | ✅ Required | All scopes | ✅ Present | Verify correct API key in production |
| `CLOUDINARY_API_SECRET` | ✅ Required | All scopes | ✅ Present | Keep secret — Production scope only recommended |
| `SMS_GATEWAY_URL` | ✅ Required | Production | ❌ **MISSING** | BulkSMSBD API endpoint — required for OTP delivery; without it, all OTP flows throw `OtpDeliveryUnavailableError` |
| `SMS_GATEWAY_TOKEN` | ✅ Required | Production | ❌ **MISSING** | BulkSMSBD API key — required for OTP delivery |
| `SMS_SENDER_ID` | ✅ Required | Production | ❌ **MISSING** | Approved sender ID from BulkSMSBD — must be pre-approved by BTRC |
| `SSLCOMMERZ_STORE_ID` | ✅ Critical | Production | ✅ Present **(sandbox)** | **Replace with live Store ID** before go-live; sandbox ID will not process real payments |
| `SSLCOMMERZ_STORE_PASSWORD` | ✅ Critical | Production | ✅ Present **(sandbox)** | **Replace with live Store Password** before go-live |
| `SSLCOMMERZ_IS_LIVE` | ✅ Critical | Production | ❌ **Wrong: `false`** | **Must be set to `true`** in Production scope; current value routes all payments to sandbox |
| `SSLCOMMERZ_SUCCESS_URL` | ✅ Critical | Production | ✅ Present | Verify value uses `https://khatikhadyo.com/...` — not a preview URL |
| `SSLCOMMERZ_FAIL_URL` | ✅ Critical | Production | ✅ Present | Verify value uses `https://khatikhadyo.com/...` — not a preview URL |
| `SSLCOMMERZ_CANCEL_URL` | ✅ Critical | Production | ✅ Present | Verify value uses `https://khatikhadyo.com/...` — not a preview URL |
| `SSLCOMMERZ_IPN_URL` | ✅ Critical | Production | ✅ Present | Verify value uses `https://khatikhadyo.com/...` — SSLCOMMERZ posts IPN to this URL; must be publicly accessible |
| `EMAIL_FROM` | 🟡 Required (post-launch OK) | Production | ❌ **MISSING** | Add once email provider is configured (§3) |
| `EMAIL_PROVIDER` | 🟡 Required (post-launch OK) | Production | ❌ **MISSING** | Add once email provider is selected |
| `RESEND_API_KEY` | 🟡 Required (post-launch OK) | Production | ❌ **MISSING** | Add once Resend account is set up and domain verified |

### 4.3 Generating a Secure `CRON_SECRET`

```bash
# macOS / Linux — generate a 40-character hex secret
openssl rand -hex 40

# Node.js alternative
node -e "console.log(require('crypto').randomBytes(40).toString('hex'))"
```

Add the output to Vercel:

```bash
vercel env add CRON_SECRET production
# Paste the generated value when prompted
```

The cron endpoint at `src/app/api/cron/expire-pending-orders/route.ts` validates this secret from the `Authorization: Bearer <CRON_SECRET>` header sent by Vercel Cron.

### 4.4 Environment Variable Scope Summary

```
Production scope  → khatikhadyo.com deployment
  DATABASE_URL, DIRECT_URL, JWT_SECRET, OTP_SECRET, CRON_SECRET,
  NEXT_PUBLIC_APP_URL, REDIS_URL,
  CLOUDINARY_*, SMS_*, SSLCOMMERZ_*, EMAIL_*

Preview scope     → preview deployments (PRs, dev previews)
  DATABASE_URL (dev Neon branch), DIRECT_URL (dev Neon branch),
  JWT_SECRET, OTP_SECRET, REDIS_URL, CLOUDINARY_*
  (SSLCOMMERZ sandbox vars — preview should always use sandbox)
  (DO NOT set NEXT_PUBLIC_APP_URL in Preview — let VERCEL_URL take over)

Development scope → local via `vercel env pull`
  All vars with localhost/dev values
```

---

## 5. Production Data Safety

### 5.1 Migration Procedure

> [!CAUTION]
> **Never** run `prisma db push` or `prisma migrate dev` against the production database. These commands can cause irreversible data loss. Use only `prisma migrate deploy` for production migrations.

```bash
# Correct — applies pending migrations without prompt, safe for production
npx prisma migrate deploy

# NEVER run these against production:
# npx prisma db push                     # bypasses migration history
# npx prisma migrate dev                 # may drop/recreate tables
# npx prisma migrate reset               # drops all tables and re-seeds
# npx prisma migrate deploy --accept-data-loss  # explicitly accepts data loss
```

**Current migration status:** 3 migrations applied, schema up to date. No pending migrations at time of this audit.

### 5.2 Neon Database Branching Strategy

| Branch | Purpose | Connection used by |
|--------|---------|-------------------|
| `main` | Production database | Vercel Production env `DATABASE_URL` / `DIRECT_URL` |
| `dev` | Development and PR preview testing | Vercel Preview env `DATABASE_URL` / `DIRECT_URL` |

> [!TIP]
> Neon's branching is instantaneous and copy-on-write. Before running any risky migration in production, create a point-in-time branch from `main`, run the migration there, and verify the results before applying to the real `main` branch.

### 5.3 Backup Strategy

| Method | Frequency | Retention | Notes |
|--------|-----------|-----------|-------|
| Neon PITR (Point-In-Time Recovery) | Continuous | 7 days (free tier) / 30 days (paid) | Automatic — no action needed |
| `pg_dump` manual export | Weekly minimum | Keep ≥ 4 weeks | Run before every migration |
| Neon branch snapshot | Before each migration | Keep for duration of migration window | Instant, free, easy rollback |

```bash
# Manual pg_dump backup (run from local machine with DATABASE_URL set)
pg_dump "$DATABASE_URL" --format=custom --no-acl --no-owner \
  --file="khatikhadyo-backup-$(date +%Y%m%d-%H%M%S).dump"
```

### 5.4 Backup Restore Drill

A restore drill must be performed **before go-live** to confirm backup integrity:

```
1. Create a Neon branch: "restore-drill-YYYYMMDD" from main
2. Obtain the connection string for that branch
3. Run: pg_restore --clean --no-owner --dbname="<drill-branch-url>" khatikhadyo-backup-*.dump
4. Connect to the drill branch and run:
   SELECT COUNT(*) FROM "User";
   SELECT COUNT(*) FROM "Order";
   SELECT COUNT(*) FROM "Product";
5. Verify row counts match expected values
6. Delete the drill branch after verification
```

### 5.5 Seed Prohibition

> [!CAUTION]
> **Never run `prisma db seed` in production.** The seed script is for local development only and will overwrite or duplicate production data. The only safe way to provision or recover an admin user in production is:

```bash
CONFIRM_SAFE_ADMIN_UPSERT=true \
ADMIN_EMAIL=admin@khatikhadyo.com \
ADMIN_PHONE=<phone> \
ADMIN_PASSWORD=<secure-password> \
npx tsx scripts/safe-upsert-admin.ts
```

This script performs an upsert (insert or update) with an explicit confirmation flag and is safe to run against production.

**Current admin status:** `admin@khatikhadyo.com` — `role=admin`, `isActive=true`. No action needed unless credentials need rotation.

### 5.6 Audit Log Monitoring

The `AuditLog` model is present in the Prisma schema. All sensitive operations (admin actions, auth events, order mutations) should write to this table. Post-launch monitoring plan:

- [ ] Review `AuditLog` entries daily for the first 2 weeks after launch
- [ ] Set up a Vercel Log Drain or export to a logging service (e.g., Axiom, Datadog) for persistent audit history beyond Vercel's 1-hour log retention
- [ ] Alert on unusual patterns: multiple failed logins, high admin-action volume, abnormal order mutation rates

### 5.7 Error Monitoring

| Tool | Current status | Recommendation |
|------|---------------|----------------|
| Vercel Runtime Logs | ✅ Available | Use for immediate post-launch monitoring |
| Vercel Log Drain | ❌ Not configured | Configure for persistent log storage |
| **Sentry** | ❌ Not integrated | **Recommended** — add `@sentry/nextjs` for error tracking, performance monitoring, and alerting |

```bash
# To add Sentry (Engineering task — post-launch P1)
npx @sentry/wizard@latest -i nextjs
```

---

## 6. SSLCOMMERZ Sandbox-to-Live Checklist

> [!CAUTION]
> **Current state: `SSLCOMMERZ_IS_LIVE=false`** — All payment attempts go to the SSLCOMMERZ sandbox and no real money is processed. This is correct for development but must be changed before accepting customer payments.

### 6.1 Steps to Enable Live Payments

- [ ] **Step 1 — Apply for SSLCOMMERZ Live Account**  
  Contact SSLCOMMERZ at [sslcommerz.com](https://sslcommerz.com) and submit your business documents (trade license, bank details, website URL). Approval typically takes 3–7 business days.

- [ ] **Step 2 — Receive Live Credentials**  
  SSLCOMMERZ will provide a live Store ID and Store Password. These are different from sandbox credentials.

- [ ] **Step 3 — Add custom domain in Vercel Dashboard**  
  Domain must be live and SSL-verified before SSLCOMMERZ live mode will accept it (§2).

- [ ] **Step 4 — Update Vercel Production env vars**  
  In Vercel Dashboard → Settings → Environment Variables → Production scope:
  ```
  SSLCOMMERZ_STORE_ID       = <live store ID>
  SSLCOMMERZ_STORE_PASSWORD = <live store password>
  SSLCOMMERZ_IS_LIVE        = true
  SSLCOMMERZ_SUCCESS_URL    = https://khatikhadyo.com/checkout/success
  SSLCOMMERZ_FAIL_URL       = https://khatikhadyo.com/checkout/fail
  SSLCOMMERZ_CANCEL_URL     = https://khatikhadyo.com/checkout/cancel
  SSLCOMMERZ_IPN_URL        = https://khatikhadyo.com/api/payments/ipn
  ```

- [ ] **Step 5 — Redeploy after env var changes**  
  Vercel does not auto-redeploy on env var changes. Trigger a fresh deployment:
  ```bash
  vercel --prod
  # or push a commit to the production branch
  ```

- [ ] **Step 6 — Test one live transaction**  
  Place a real order with a low amount (e.g., ৳10 / 1 BDT test where possible) using a real payment card. Verify:
  - Payment completes successfully
  - IPN callback is received at `https://khatikhadyo.com/api/payments/ipn`
  - Order status changes to `CONFIRMED` in the database
  - `AuditLog` records the IPN event

- [ ] **Step 7 — Monitor IPN logs for 24 hours**  
  Watch Vercel runtime logs for the `/api/payments/ipn` route. Confirm signature verification is passing and no `401` or `500` errors appear.

### 6.2 IPN Signature Verification Reminder

The IPN handler already implements SSLCOMMERZ signature verification. No code changes are needed to go live. The transition from sandbox to live is entirely an environment variable change.

---

## 7. Launch Test Checklist

> [!NOTE]
> Run this checklist against the **production deployment** (`https://khatikhadyo.com`) after all env vars are configured and the domain is live. Use a fresh incognito browser session for each test scenario. Mark each scenario Pass ✅ or Fail ❌.

| # | Scenario | Steps | Expected Result | Pass/Fail |
|---|----------|-------|----------------|-----------|
| 1 | **Customer signup with phone OTP** | Go to `/register`, enter phone number, submit OTP form | OTP SMS received; account created; redirected to dashboard | ☐ |
| 2 | **Customer signup with email** | Go to `/register`, enter email address, complete signup | Account created; confirmation email received (if email configured); redirected to dashboard | ☐ |
| 3 | **Customer login → session persists on refresh** | Log in at `/login`; refresh page; navigate to `/account` | User remains logged in; protected page loads; session cookie present | ☐ |
| 4 | **Customer logout → protected routes inaccessible** | Log in; click logout; navigate to `/account` directly | Redirected to `/login`; no session cookie; no authenticated data exposed | ☐ |
| 5 | **Product ad link generation (admin only)** | Log in as `admin@khatikhadyo.com`; go to admin panel; generate ad link for a product | Ad link generated successfully; non-admin user cannot access the endpoint (403) | ☐ |
| 6 | **Add to cart → checkout → COD order placement** | As a customer, add a product to cart; proceed to checkout; select Cash on Delivery; confirm order | Order created with status `PENDING`; inventory decremented; order visible in customer account and admin panel | ☐ |
| 7 | **Add to cart → checkout → SSLCOMMERZ payment (sandbox)** | As a customer, add product to cart; checkout; select online payment; complete sandbox payment | Redirect to SSLCOMMERZ sandbox; payment completes; IPN received; order status changes to `CONFIRMED`; inventory decremented | ☐ |
| 8 | **Failed payment → inventory restored** | Initiate SSLCOMMERZ payment; use a card that triggers a failure; return to site | Order remains `PENDING` or cancelled; inventory count is restored to pre-checkout value; no double-decrement | ☐ |
| 9 | **Cancelled payment → inventory restored** | Initiate SSLCOMMERZ payment; click Cancel on SSLCOMMERZ page; return to site | Order cancelled; inventory count restored; customer sees a cancellation message | ☐ |
| 10 | **Admin login → order management** | Log in as `admin@khatikhadyo.com`; navigate to admin orders panel | All orders visible; order details accessible; order list paginates correctly | ☐ |
| 11 | **Admin order status progression** | In admin panel, change an order from `PENDING` → `CONFIRMED` → `SHIPPED` → `DELIVERED` | Each status transition is saved; `AuditLog` records each change; customer-facing order status updates accordingly | ☐ |
| 12 | **A4 dual-voucher print** | In admin panel, open an order; click print voucher | A4 print dialog opens; voucher renders with correct order details, two per page; no layout overflow | ☐ |
| 13 | **Mobile smoke test (375px viewport)** | Open `https://khatikhadyo.com` in Chrome DevTools at 375×812 (iPhone 14); navigate: Home → Product → Cart → Checkout | No horizontal scroll; tap targets ≥ 44px; no overlapping elements; checkout form usable on mobile | ☐ |
| 14 | **Desktop smoke test (1440px viewport)** | Open `https://khatikhadyo.com` in a maximized desktop browser (1440px); navigate full user journey | Layout correct at large viewport; no stretched images; nav menu functional; checkout flow complete | ☐ |
| 15 | **Invalid login returns 401, not 500** | POST to `/api/auth/login` with wrong credentials (via browser dev tools or curl) | Response is `401 Unauthorized` with a JSON error body; no stack trace leaked; no `500 Internal Server Error` | ☐ |

### 7.1 Pre-Test Requirements

Before running the launch test checklist, confirm:

- [ ] Custom domain `https://khatikhadyo.com` is live and SSL is valid
- [ ] All Production env vars are set in Vercel (§4)
- [ ] `SSLCOMMERZ_IS_LIVE=false` during sandbox testing (switch to `true` only for live payment test in §6)
- [ ] At least one product is published in the database
- [ ] Admin account `admin@khatikhadyo.com` is active
- [ ] SMS gateway is configured (for test #1)
- [ ] Vercel Preview Protection is disabled or bypassed (for any preview-URL payment tests)

---

## 8. Rollback Plan

### 8.1 Vercel Deployment Rollback

Vercel supports instant rollback to any previous successful deployment. No downtime required.

```bash
# Via Vercel Dashboard
Project → Deployments → find previous stable deployment → "..." menu → Promote to Production

# Via Vercel CLI
vercel rollback [deployment-url]
# Example:
vercel rollback https://11111-abc123def.vercel.app
```

> [!TIP]
> Vercel rollback is instantaneous (< 1 second) because it re-aliases the production domain to a previous deployment without rebuilding. Keep your last 3 known-good deployment URLs documented so you can rollback quickly under pressure.

### 8.2 Database Migration Rollback

> [!CAUTION]
> Prisma does not support automatic down-migrations. Database rollback requires careful manual steps. This is why backups (§5.3) and Neon branching are critical.

```bash
# If a migration was applied but needs to be rolled back:

# Step 1 — Restore from Neon branch snapshot (fastest, safest)
# In Neon Dashboard: branch → Restore → select pre-migration point in time

# Step 2 — If using pg_dump backup:
pg_restore --clean --no-owner \
  --dbname="$DATABASE_URL" \
  khatikhadyo-backup-YYYYMMDD.dump

# Step 3 — Mark the failed migration as rolled back in Prisma's history
npx prisma migrate resolve --rolled-back <migration_name>
# Example:
npx prisma migrate resolve --rolled-back 20241113120000_add_coupon_table

# Step 4 — Redeploy the previous application version (§8.1)
```

### 8.3 DNS Rollback

If the domain cutover causes issues, DNS rollback is possible if you prepared before cutover:

| Preparation step | Action |
|-----------------|--------|
| **Before cutover** | Set all DNS record TTLs to 300 seconds (5 minutes) at least 48 hours before switching |
| **During cutover** | Note the previous A record IP address before changing it |
| **If rollback needed** | Change the A record back to the old IP; propagation completes in ≤ 300 seconds (the TTL you set) |

> [!WARNING]
> If you did not lower the TTL before cutover and your registrar's default TTL is 86400s (24 hours), DNS rollback will take up to 24 hours to propagate globally. Always lower TTL 48 hours before any DNS cutover.

### 8.4 Rollback Decision Criteria

Trigger a rollback if any of the following occur within 30 minutes of a production deployment:

- Error rate on `/api/*` endpoints exceeds 5%
- Payment IPN endpoint returning non-200 responses
- Customer-facing 500 errors visible in Vercel logs
- Database connection failures
- Authentication broken (all users logged out or unable to log in)

---

## 9. Final Sections

---

### 9.1 Owner Must Configure

These items require business-level decisions or access that only the domain owner or business operator can provide. Engineering cannot complete these unilaterally.

- [ ] **Custom domain purchase and DNS control**  
  Ensure `khatikhadyo.com` is registered and DNS is manageable by the team performing the cutover. Confirm registrar login credentials are accessible.

- [ ] **DNS cutover timing**  
  Plan the cutover during low-traffic hours (e.g., 2–4 AM Bangladesh Standard Time). Lower DNS TTLs to 300s at least 48 hours before the planned cutover date.

- [ ] **BulkSMSBD account and approved Sender ID**  
  Create or verify a BulkSMSBD account at [bulksmsbd.com](https://bulksmsbd.com). The Sender ID (displayed to SMS recipients) must be pre-approved by BTRC. Approval can take 5–10 business days. Provide `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`, and `SMS_SENDER_ID` values to Engineering for Vercel env var configuration.

- [ ] **SSLCOMMERZ live account approval**  
  Submit business documents to SSLCOMMERZ for live merchant account approval. Provide live `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD` to Engineering when approved. Do not share credentials over insecure channels.

- [ ] **Email provider account and domain verification**  
  Create an account with the chosen email provider (Resend, SendGrid, or AWS SES). Verify `khatikhadyo.com` domain ownership in the provider's dashboard (involves adding DNS TXT records for DKIM). Provide the API key to Engineering for Vercel env var configuration.

- [ ] **Vercel env var updates for Production scope**  
  After receiving live credentials from BulkSMSBD, SSLCOMMERZ, and the email provider, update the Vercel Production env vars in Vercel Dashboard. Confirm values are set in Production scope only (not Preview or Development) for sensitive secrets.

- [ ] **Disable Vercel Preview Deployment Protection (or configure bypass)**  
  In Vercel Dashboard → Settings → Deployment Protection: either disable Vercel Authentication for the preview environment, or configure a Protection Bypass Secret and distribute it to authorized testers. This is required before QA can test payment flows on preview deployments.

- [ ] **Neon production database access**  
  Confirm that the Neon `main` branch connection string is what is set in Vercel's Production `DATABASE_URL` and `DIRECT_URL`. Ensure the Neon account has automated backups enabled and PITR retention is at least 7 days.

---

### 9.2 Engineering Must Complete

These items are code or infrastructure changes that the Engineering team must implement before or shortly after launch.

- [ ] **Add `CRON_SECRET` to Vercel env vars (all scopes)**  
  Generate a secure 40-character hex secret (see §4.3) and add it to Vercel for Production, Preview, and Development scopes. This is the single highest-priority blocking item — the cron job `expire-pending-orders` cannot run securely without it.

  ```bash
  vercel env add CRON_SECRET production
  vercel env add CRON_SECRET preview
  vercel env add CRON_SECRET development
  ```

- [ ] **Add `vercel.json` with Cache-Control headers**  
  Add a `vercel.json` to the project root to set appropriate `Cache-Control` headers for static assets, API routes, and pages. Example:

  ```json
  {
    "headers": [
      {
        "source": "/_next/static/(.*)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "/api/(.*)",
        "headers": [{ "key": "Cache-Control", "value": "no-store, no-cache" }]
      }
    ]
  }
  ```

- [ ] **Add `lang="bn"` to `<html>` element**  
  The site serves Bangladeshi (Bengali) content. The root `<html>` tag should declare `lang="bn"` for accessibility and SEO. Update the root layout file (`app/layout.tsx`):

  ```tsx
  <html lang="bn">
  ```

  For a bilingual site (Bengali + English), use `lang="bn"` as the primary with English sections wrapped in `<span lang="en">` where appropriate.

- [ ] **Add transactional email provider integration**  
  Install and configure Resend (or the chosen provider). Create an email utility at `src/lib/email.ts` that wraps the provider SDK. Scope: install package, add env vars, wire up sender.

  ```bash
  npm install resend
  # or
  npm install @sendgrid/mail
  ```

- [ ] **Build order confirmation email template**  
  Create a React Email (or HTML) template for order confirmation. Send it from the SSLCommerz IPN handler (after payment confirmed) and from the COD order placement handler.

- [ ] **Build order status update email template**  
  Create a template for status transitions (confirmed → shipped → delivered). Trigger from the admin order status update endpoint.

- [ ] **Fix unauthenticated coupon validate endpoint**  
  The coupon validation endpoint currently accepts requests without authentication. At minimum, add strict rate limiting (e.g., 5 requests per IP per 10 minutes). Ideally, require an authenticated session before accepting coupon validation requests to prevent brute-force coupon code enumeration.

- [ ] **Remove unused `next-auth` dependency**  
  The project uses a custom JWT authentication system. `next-auth` appears to be an unused dependency that adds unnecessary bundle weight and potential vulnerability surface. Confirm it is unused, then remove:

  ```bash
  npm uninstall next-auth
  ```

- [ ] **Add E2E tests with Playwright**  
  The 43 existing automated tests cover unit/integration levels. Add Playwright E2E tests covering at minimum: customer signup → product add to cart → checkout → order confirmation. Store tests in `e2e/` directory.

  ```bash
  npm init playwright@latest
  ```

- [ ] **Upgrade OG image to 1200×630 Cloudinary-hosted image**  
  Replace the current Open Graph image with a properly sized (1200×630 px) image hosted on Cloudinary. Update the `<meta property="og:image">` tag in the root layout to reference the Cloudinary URL. This ensures correct image display when sharing on WhatsApp, Facebook, and Twitter/X.

---

### 9.3 Ready to Launch ✅

The following items have been audited and confirmed complete. No action required.

| ✅ | Item | Details |
|----|------|---------|
| ✅ | Prisma migrations applied and up to date | 3 migrations applied; `prisma migrate status` shows no pending migrations |
| ✅ | Admin user provisioned and active | `admin@khatikhadyo.com` — `role=admin`, `isActive=true` |
| ✅ | JWT authentication with httpOnly cookies | Session tokens stored in httpOnly, Secure, SameSite=Strict cookies — XSS-resistant |
| ✅ | CSRF guard on all mutations | All state-changing API routes protected against cross-site request forgery |
| ✅ | Rate limiting on login / register / OTP | Redis-backed distributed rate limiting prevents brute-force attacks on auth endpoints |
| ✅ | Order authorization (Phase 2C.1) | Customers can only view/modify their own orders; admin-only routes enforce role check |
| ✅ | SSLCOMMERZ IPN signature verification | IPN handler validates MD5 hash signature from SSLCOMMERZ before processing payment confirmation |
| ✅ | Atomic inventory + coupon release on cancel | Cancel and fail payment handlers atomically restore inventory and release coupon in a single transaction |
| ✅ | OTP with timing-safe comparison and 5-attempt lockout | `crypto.timingSafeEqual()` used for OTP comparison; account locked after 5 failed attempts |
| ✅ | `robots.txt` and `sitemap.xml` | Both present and correctly generated; `sitemap.xml` uses `getBaseUrl()` for `<loc>` entries |
| ✅ | Product JSON-LD schema | Structured data (`application/ld+json`) present on product pages for rich search results |
| ✅ | A4 print blueprint complete | Dual-voucher A4 print layout implemented and verified |
| ✅ | 43/43 automated tests passing | Full test suite green on `phase-1b-implementation` branch |
| ✅ | TypeScript + ESLint 0 errors | No type errors or lint violations in codebase |

---

## Appendix A — Blocking Launch Items Summary

The following items must be resolved **before accepting real customer orders**. Each is tagged with the responsible party.

| Priority | Item | Owner | Section |
|----------|------|-------|---------|
| 🔴 P0 | `CRON_SECRET` missing from Vercel | Engineering | §4.2, §9.2 |
| 🔴 P0 | `SSLCOMMERZ_IS_LIVE=false` (sandbox mode active) | Owner + Engineering | §6, §4.2 |
| 🔴 P0 | `SSLCOMMERZ_STORE_ID` / `STORE_PASSWORD` are sandbox credentials | Owner | §6, §4.2 |
| 🔴 P0 | SSLCOMMERZ callback URLs must be verified to use production domain | Engineering | §2.6, §4.2 |
| 🔴 P0 | SMS env vars missing (`SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`, `SMS_SENDER_ID`) | Owner + Engineering | §3.6, §4.2 |
| 🔴 P0 | Custom domain `khatikhadyo.com` DNS not yet configured | Owner | §2 |
| 🟡 P1 | Vercel Preview Deployment Protection blocking API access | Owner | §2.6 |
| 🟡 P1 | Transactional email not configured (order confirmation unavailable) | Owner + Engineering | §3 |
| 🟡 P1 | Email templates not built | Engineering | §3.5, §9.2 |
| 🟡 P1 | Coupon validate endpoint lacks authentication | Engineering | §9.2 |
| 🟡 P1 | `lang="bn"` missing from `<html>` | Engineering | §9.2 |
| 🟢 P2 | `vercel.json` Cache-Control headers | Engineering | §9.2 |
| 🟢 P2 | Playwright E2E tests | Engineering | §9.2 |
| 🟢 P2 | Remove unused `next-auth` dependency | Engineering | §9.2 |
| 🟢 P2 | Upgrade OG image to 1200×630 | Engineering | §9.2 |
| 🟢 P2 | Sentry error monitoring integration | Engineering | §5.7 |

---

## Appendix B — Quick Reference Commands

```bash
# Generate a secure secret (for CRON_SECRET, JWT_SECRET, etc.)
openssl rand -hex 40

# Add an env var to Vercel Production
vercel env add VARIABLE_NAME production

# Pull env vars for local development
vercel env pull .env.local

# Apply database migrations (production-safe)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Admin user recovery
CONFIRM_SAFE_ADMIN_UPSERT=true \
ADMIN_EMAIL=admin@khatikhadyo.com \
npx tsx scripts/safe-upsert-admin.ts

# Manual database backup
pg_dump "$DATABASE_URL" --format=custom --no-acl --no-owner \
  --file="khatikhadyo-backup-$(date +%Y%m%d-%H%M%S).dump"

# Run full test suite
npm test

# Type check
npx tsc --noEmit

# Lint check
npx eslint . --max-warnings 0

# Instant rollback via CLI
vercel rollback [previous-deployment-url]
```

---

*Document generated: 2026-11-13 | Branch: `phase-1b-implementation` | Vercel project: `11111` | Domain: `khatikhadyo.com`*  
*This is a preflight audit document. No deployments, DNS changes, or env var mutations were performed in producing it.*
