# Phase 1C.1: Non-Destructive Admin Account Recovery Implementation Report

**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Date:** 2026-11-01  
**Branch:** `phase-1b-implementation`  
**Engineer:** Antigravity AI Senior Architect  
**Status:** Completed, Verified & Tested (Zero Database Mutations in Production, No Deploy)

---

## 1. Executive Summary

Phase 1C.1 prepares a safe, non-destructive admin account creation and recovery mechanism for the Khati Khadyo platform. In accordance with strict operational constraints:
- **Zero Data Loss Guarantee:** Under no circumstances does this mechanism execute `deleteMany()`, `truncate()`, drops, or table resets.
- **Production Guard:** Execution in production (`NODE_ENV=production` or `VERCEL_ENV=production`) is strictly blocked unless the operator explicitly passes `CONFIRM_SAFE_ADMIN_UPSERT=true`.
- **Security & Privacy:** Plaintext passwords are never logged or stored; passwords are cryptographically hashed using bcrypt (12 rounds) adhering to the existing auth architecture. Logs display only masked email addresses (e.g. `a***n@khatikhadyo.com`).
- **Session Invalidation on Rotation:** When updating an existing admin or resetting credentials, the utility increments `sessionVersion`, immediately revoking all previously active JWT sessions across devices.

---

## 2. Modified & Created Files Inventory

| File Path | Nature of Change | Purpose |
|---|---|---|
| [`scripts/safe-upsert-admin.ts`](file:///Users/nasimp/Desktop/11111/1/scripts/safe-upsert-admin.ts) | **Created** | Standalone, non-destructive admin recovery tool with production safety guards, email masking, and bcrypt hashing. |
| [`package.json`](file:///Users/nasimp/Desktop/11111/1/package.json#L14) | **Modified** | Added dedicated safe script command `"admin:upsert-safe"`. Existing seed commands remain untouched. |
| [`docs/ADMIN_RECOVERY_RUNBOOK.md`](file:///Users/nasimp/Desktop/11111/1/docs/ADMIN_RECOVERY_RUNBOOK.md) | **Created** | Operational runbook explaining secure credential input, rotation, and HTTP status diagnosis (401, 403, 429, 500). |
| [`tests/safe-upsert-admin.test.mjs`](file:///Users/nasimp/Desktop/11111/1/tests/safe-upsert-admin.test.mjs) | **Created** | Automated test suite verifying creation, promotion, rotation, input validation, production guard, and zero deletions. |
| [`docs/PHASE_1C_1_ADMIN_RECOVERY_REPORT.md`](file:///Users/nasimp/Desktop/11111/1/docs/PHASE_1C_1_ADMIN_RECOVERY_REPORT.md) | **Created** | Phase 1C.1 completion report. |

---

## 3. Automated Verification & Test Results

```bash
> nextjs_tailwind_shadcn_ts@0.2.1 test
> node --loader ./scripts/test-loader.mjs --test --test-concurrency=1 tests/**/*.test.mjs

✔ 1. Handler-level: browser success/fail/cancel callback route never mutates Order or Payment fields (41.78ms)
✔ 2. Handler-level: forged browser transaction ID cannot mutate database state (12.41ms)
✔ 3. Handler-level: validated IPN successfully transitions order to paid (15.18ms)
✔ 4. Handler-level: authoritative IPN failure transitions order to failed and releases stock & coupon (18.93ms)
✔ 5. Handler-level: browser callback writes minimal append-only audit log with no secrets or raw gateway payload (9.62ms)
✔ 1. Successful payment: stock is NOT restored and order transitions to paid/confirmed (1.07ms)
✔ 2. Failed payment: stock and coupon are released atomically in one transaction (0.14ms)
✔ 3. Cancelled payment: stock and coupon are released (0.08ms)
✔ 4. 30-minute expired pending order: cleanup cron releases stock and coupon (0.11ms)
✔ 5. Duplicate IPN: idempotent, zero duplicate stock/coupon/audit updates (0.08ms)
✔ 6. IPN and browser redirect concurrent race condition: handled safely without double restore (0.08ms)
✔ 7. Low-stock concurrent checkout: atomic updateMany prevents oversell (0.11ms)
✔ 1. Prisma Integration: simultaneous duplicate IPN (39.79ms)
✔ 2. Prisma Integration: IPN বনাম browser cancel redirect (11.09ms)
✔ 3. Prisma Integration: duplicate expiry cron (13.08ms)
✔ 4. Prisma Integration: successful payment বনাম late failure callback (10.45ms)
✔ 5. Prisma Integration: stock/coupon exactly once restore under concurrent release requests (33.97ms)
✔ 1. Mask email utility works correctly and hides private characters (0.43ms)
✔ 2. New user -> safely creates admin user with bcrypt hash (568.46ms)
✔ 3. Existing non-admin user -> safely promotes to admin and updates credentials (559.90ms)
✔ 4. Existing admin -> idempotent result and password rotation (1132.64ms)
✔ 5. Missing or invalid required inputs fail gracefully with clear errors (0.48ms)
✔ 6. Production guard blocks execution without explicit confirmation flag (289.89ms)
✔ 7. Absolute non-destructive guarantee: zero records deleted or truncated (297.02ms)

ℹ tests 24
ℹ suites 0
ℹ pass 24
ℹ fail 0
ℹ duration_ms 4547.85
```

### Full Quality Gate Status:
- **Test Suite:** **24/24 tests passed** (100% pass rate).
- **TypeScript Check:** `npx tsc --noEmit` passed with 0 errors.
- **ESLint:** `npm run lint` passed with 0 errors, 0 warnings.
- **Security Headers:** `npm run verify:headers` verified all CSP, HSTS, and frame protection headers.
- **Production Standalone Build:** `npm run build` compiled successfully.

---

## 4. How the Operator Runs the Safe Admin Creation Tool

To create or recover the admin account without exposing passwords in shell history or log files, execute the following commands in your terminal:

```bash
# 1. Switch to project directory
cd 1

# 2. Enter credentials interactively (password input is silent and not saved in shell history)
read -p "Enter Admin Email: " ADMIN_EMAIL
read -s -p "Enter Admin Password (min 8 chars): " ADMIN_PASSWORD
echo ""

# 3. Execute the non-destructive upsert tool with production confirmation
ADMIN_EMAIL="$ADMIN_EMAIL" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
CONFIRM_SAFE_ADMIN_UPSERT="true" \
npm run admin:upsert-safe

# 4. Clear sensitive shell variables from memory
unset ADMIN_EMAIL ADMIN_PASSWORD CONFIRM_SAFE_ADMIN_UPSERT
```

**What happens behind the scenes:**
1. The tool validates the email format and ensures the password is $\ge 8$ characters.
2. Checks whether `CONFIRM_SAFE_ADMIN_UPSERT=true` is provided when running in production.
3. Hashes the password with 12 rounds of bcrypt.
4. Queries the user table:
   - If not found: creates a new user with `role: 'admin'`, `isActive: true`, `isVerified: true`.
   - If found: safely updates `role: 'admin'`, `isActive: true`, rotates the password hash, and increments `sessionVersion` to log out any stale sessions.
5. Emits an audit log entry (`ADMIN_ACCOUNT_CREATED` or `ADMIN_ACCOUNT_UPDATED`).
6. Zero orders, coupons, reviews, or other customer data are affected.

---

## 5. Vercel Dashboard Environment Variables Checklist

To ensure the preview and production environments on Vercel run seamlessly, configure the following variables in the **Vercel Project Settings $\rightarrow$ Environment Variables**:

| Variable Name | Environment Scope | Requirement / Description |
|---|---|---|
| `DATABASE_URL` | Production, Preview | PostgreSQL connection pooler string (e.g. Neon connection pooler with `?sslmode=require`). |
| `DIRECT_URL` | Production, Preview | PostgreSQL direct connection string (required by Prisma for schema migrations). |
| `JWT_SECRET` | Production, Preview | High-entropy random secret of **at least 32 characters** used to sign user auth tokens. |
| `CRON_SECRET` | Production, Preview | Secret token used to authenticate automated pending order cleanup calls (`/api/cron/expire-pending-orders`). |
| `NEXT_PUBLIC_APP_URL` | Production | Canonical production domain URL (e.g. `https://khatikhadyo.com`). Leave unset on Preview for dynamic hostname detection. |
| `SSLCOMMERZ_STORE_ID` | Production, Preview | SSLCOMMERZ Store ID (from merchant account). |
| `SSLCOMMERZ_STORE_PASSWORD` | Production, Preview | SSLCOMMERZ Store Password. |
| `SSLCOMMERZ_IS_LIVE` | Production | Set to `"true"` for live production; `"false"` for sandbox preview testing. |
| `OTP_SECRET` | Production, Preview | Secret key ($\ge 32$ chars) used to hash OTP challenges when SMS gateway is activated. |
| `REDIS_URL` | Production (Optional) | Shared Redis instance URL for distributed rate limiting across serverless instances. |

*(Note: Secrets, passwords, tokens, and database URLs are strictly excluded from this report per project security rules).*
