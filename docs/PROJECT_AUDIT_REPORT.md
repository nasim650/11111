# KHATI KHADYO — COMPREHENSIVE PROJECT AUDIT REPORT
**Platform:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Audit Date:** 2026-11-01  
**Scope:** Full Source Code Analysis, Architecture, Security, Payments, Database, SEO, and Quality Assurance  
**Auditor:** Antigravity AI Senior Engineering Architect  
**Audit Status:** Read-Only Complete (Zero production code modified during audit)  

---

## 1. Executive Summary

A comprehensive architectural and source code audit was conducted on the Khati Khadyo e-commerce codebase (`1/`). The project demonstrates thoughtful domain modeling for the Bangladeshi e-commerce landscape—including division/district administrative dropdowns, SMS OTP verification with HMAC hashing, Bengali currency formatting, and SSLCOMMERZ gateway verification logic.

However, the audit revealed **four critical blockers** that significantly impair production readiness:
1. **Architectural Mismatch (SPA Simulation in App Router):** Despite using Next.js 16 App Router, the entire customer and admin experience is rendered inside a single client-side component (`src/app/page.tsx`) using Zustand state. No dedicated route segments exist for `/products`, `/products/[slug]`, `/cart`, `/checkout`, or `/orders`. This breaks browser history, URL sharing, and results in total SEO failure (all sitemap URLs return 404).
2. **Online Payment Inventory Drain:** When an online order is placed via SSLCOMMERZ, stock is decremented immediately. If the user cancels the payment at the gateway or the transaction fails, the stock is **never restored**, leading to rapid artificial inventory exhaustion.
3. **Ghost Dependency (`jose`):** The application relies on `jose` in `src/lib/auth.ts` for all JWT signing and verification, but `jose` is not listed in `package.json`. It only resolves locally because of hoisted dependencies. Clean CI/CD or container builds with strict package managers will fail immediately.
4. **Zero Automated Test Coverage (0%):** There are no unit, integration, or end-to-end tests, nor are test runners (Vitest/Playwright) installed.

---

## 2. Current Architecture & Dependency Map

### 2.1 Technology Stack
- **Framework:** Next.js 16.1.1 (App Router) with React 19.0.0
- **Language:** TypeScript 5 (Strict Mode enabled)
- **Styling & UI:** Tailwind CSS v4, shadcn/ui (Radix UI primitives), Lucide React, Framer Motion, Sonner
- **State Management:** Zustand 5 (with `persist` middleware)
- **Database & ORM:** PostgreSQL, Prisma ORM 6.11.1
- **Caching & Limiting:** Redis (ioredis 5.11.1) with in-memory fallback
- **Authentication:** Custom JWT authentication (`jose`, `bcryptjs`) with session versions in database
- **Storage:** Cloudinary (primary) with local filesystem fallback
- **Payments:** SSLCOMMERZ (v4 API with IPN validation, hash signature verification, and query validation)

### 2.2 System Component Dependency Map
```
[Client Browser]
       │
       ▼
[Next.js App Router] ── (Only / exists for UI; /api routes exist)
       │
       ├── src/app/page.tsx (Monolithic SPA Router: Zustand currentPage state)
       │       ├── HomePage (Eager loaded)
       │       ├── ProductsPage, ProductDetailPage, CartPage (Lazy loaded)
       │       ├── CheckoutPage, OrderConfirmationPage (Lazy loaded)
       │       └── AdminDashboardPage, AdminFlashSalePage (Lazy loaded)
       │
       ├── src/app/api/
       │       ├── auth/ (register, login, me, otp, reset-password)
       │       ├── products/ (catalog, suggestions, search)
       │       ├── cart/ (server-side sync, coupon validation)
       │       ├── orders/ (checkout, stock decrement, delivery calculation)
       │       ├── payments/sslcommerz/ (initiate, callback handler, IPN, status)
       │       └── uploads/ (Cloudinary & local disk)
       │
       ├── src/lib/
       │       ├── db.ts ─────────► [PostgreSQL via Prisma ORM]
       │       ├── redis.ts ──────► [Upstash/Self-hosted Redis]
       │       ├── auth.ts ───────► [JWT Token Signing - Requires `jose`]
       │       ├── sslcommerz.ts ─► [SSLCOMMERZ Gateway API]
       │       └── cloudinary.ts ─► [Cloudinary CDN]
```

---

## 3. Documentation Cleanup Result

Prior to source analysis, historical AI task notes, redundant audit files, and ephemeral logs were audited and processed:
- **Archived (13 Files):** Moved to `1/_archive/ai-generated-docs-2026-11-01/` preserving relative hierarchy:
  - `KHATI_KHADYO_COMPLETE_AUDIT_REPORT.md` (historical audit)
  - `DATABASE_AUDIT_REPORT.md`, `CHECKOUT_AUDIT_REPORT.md`, `PRODUCTION_AUDIT.md`, `UI_UX_MASTER_AUDIT_REPORT.md`
  - `MOBILE_FIRST_UI_ARCHITECTURE_REPORT.md`, `ADDRESS_UX_IMPROVEMENT_REPORT.md`, `CART_BUG_FIX_REPORT.md`
  - `PRODUCT_CARD_HOVER_FIX.md`, `PRODUCT_VISUAL_REDESIGN_REPORT.md`, `SMART_ADDRESS_SYSTEM_REPORT.md`
  - `worklog.md` (130KB session log)
  - `prisma/# Source Directory Guidelines.md` (misplaced guideline file)
- **Deleted (2 Files):** `dev.log` and `server.log` (confirmed untracked by Git, no active processes writing).
- **Audit Trail:** Recorded in `1/docs/cleanup-log.md`.
- **Preserved Core Docs:** `111.md` (Master PRD), `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `SECURITY.md`, `DEPLOYMENT.md`, `ENVIRONMENT.md`, `INSTALLATION.md`, `RUNBOOK.md`, `PROJECT_STRUCTURE.md`, `ASSET_GUIDELINES.md`, `robots.txt`.

---

## 4. Findings Table

| ID | Severity | Area | Affected Files | Evidence | Risk / Impact | Recommended Change | Est. Effort |
|:---|:---:|:---|:---|:---|:---|:---|:---:|
| **F-01** | **Critical** | Architecture / SEO | `1/src/app/page.tsx`, `1/src/app/sitemap.ts` | All pages rendered via Zustand switch statement in `page.tsx`. Zero App Router route files exist. | Catastrophic SEO failure. Googlebot gets 404 on all sitemap URLs (`/products`, `/delivery-policy`). Browser URL does not update on navigation. | Migrate client pages to real App Router segments (`app/products/page.tsx`, `app/products/[slug]/page.tsx`, `app/cart/page.tsx`, `app/checkout/page.tsx`). | 16-24 hrs |
| **F-02** | **Critical** | Inventory & Orders | `1/src/app/api/orders/route.ts`, `1/src/app/api/payments/sslcommerz/handler.ts` | `orders/route.ts:285` decrements stock in `$transaction`. When SSLCOMMERZ payment fails or is cancelled, stock is never incremented back. | Permanent stock leakage. Every cancelled/failed payment artificially consumes inventory until products show out-of-stock. | Implement stock rollback/increment on payment cancellation, failure, and expired checkout sessions. | 4-6 hrs |
| **F-03** | **Critical** | Dependencies / Auth | `1/package.json`, `1/src/lib/auth.ts` | `import { SignJWT, jwtVerify } from 'jose'` in `src/lib/auth.ts`, but `jose` is absent from `package.json`. | Production deployment failure. Fresh CI or container builds running `npm ci` without hoisted node_modules will fail on auth. | Add `"jose": "^5.9.6"` to `package.json` dependencies. | 15 mins |
| **F-04** | **Critical** | Database Safety | `1/package.json` | `"db:push": "prisma db push --accept-data-loss"` in `scripts`. | Catastrophic data loss risk if developer or deployment pipeline runs `npm run db:push`. | Remove `--accept-data-loss` flag from scripts; enforce `prisma migrate deploy` for deployments. | 15 mins |
| **F-05** | **Critical** | Quality Assurance | `1/package.json` | 0 test files in repo. No test script, test runner, or assertions library installed. | High regression risk. Core checkout, coupon, and payment calculations can break silently. | Install Vitest + React Testing Library + Playwright; add automated test suite for checkout & cart. | 16-20 hrs |
| **F-06** | **High** | Security / Middleware | `1/src/proxy.ts` | File named `proxy.ts` instead of `middleware.ts`. Next.js convention requires `middleware.ts`. | Security headers (CSP, HSTS, X-Content-Type-Options) in `proxy.ts` are completely inactive. | Rename `src/proxy.ts` to `src/middleware.ts` and verify matcher config. | 30 mins |
| **F-07** | **High** | Commerce Pricing | `1/src/app/api/cart/route.ts`, `1/src/app/api/orders/route.ts` | Cart uses `freeShippingThreshold` (default 500); Orders checkout uses `free_shipping_threshold` (default 1500). | Customer sees free delivery in cart, but is charged delivery at checkout. Destroys customer trust. | Unify SiteConfig key naming and default values across cart and checkout. | 1-2 hrs |
| **F-08** | **High** | Media Storage | `1/src/app/api/uploads/route.ts` | `uploadToLocal` writes to `public/uploads` on local filesystem. | On Vercel / serverless containers, local disk is ephemeral and read-only. Uploaded images disappear on container recycle. | Mandate Cloudinary or configure Cloudflare R2 bucket storage adapter for all uploads. | 4-6 hrs |
| **F-09** | **High** | Database Artifacts | `1/db/custom.db`, `1/prisma/dev.db`, `1/prisma/db/custom.db`, `1/.gitignore` | 3 SQLite `.db` binary files (~1.5 MB) committed to git repository despite Postgres provider. | Repository pollution; risk of sensitive test data leakage in Git history. | Add `*.db` and `*.sqlite` to `.gitignore`; untrack committed `.db` files from Git index. | 30 mins |
| **F-10** | **High** | Security / Seeding | `1/prisma/seed.ts` | Seed script sets `admin@khatikhadyo.com` with password `admin123` and calls `deleteMany()` on all tables. | Wipeout of production data or creation of default known credentials if executed in production. | Guard seed script with `NODE_ENV !== 'production'` check; require environment-provided admin passwords. | 1 hr |
| **F-11** | **High** | CI/CD | `.github/workflows/` | No GitHub Actions workflow or deployment pipeline configured. | Code merged without automated linting, typechecking, or testing gates. | Add GitHub Actions workflow for lint, typecheck, prisma validate, and build. | 2-3 hrs |
| **F-12** | **Medium** | Accessibility (a11y) | `1/src/components/shared/ProductCard.tsx` | Clickable `Card` `div` with `onClick` wrapping nested buttons (Wishlist, QuickView, Cart). | Violates WCAG 2.1 keyboard accessibility; screen readers cannot navigate to product; middle click fails. | Replace card root with semantic Next.js `<Link>` and position auxiliary buttons cleanly. | 3-4 hrs |
| **F-13** | **Medium** | Unused Packages | `1/package.json` | `"z-ai-web-dev-sdk": "^0.0.18"` declared in dependencies but never imported. | Supply-chain risk and dependency bloat. | Remove `z-ai-web-dev-sdk` from `package.json`. | 15 mins |
| **F-14** | **Medium** | Serverless Stability | `1/src/lib/rate-limit.ts` | Line 82: `setInterval` running at module scope in serverless runtime. | Keeps serverless node processes alive, interfering with runtime lifecycle. | Remove module-level interval; rely on Redis TTL or lazy timestamp cleanup on access. | 1 hr |
| **F-15** | **Medium** | Font Configuration | `1/src/app/layout.tsx`, `1/src/app/globals.css` | Mock object `const geistSans = { variable: "font-sans" };` in layout; `--font-geist-sans` undefined in CSS. | FOUT and inconsistent font metrics across user devices. | Import Geist & Geist Mono via `next/font/google` and configure CSS variables properly. | 1 hr |
| **F-16** | **Medium** | Analytics | `1/src/components/pages/` | No e-commerce tracking (GA4, Meta Pixel) for `view_item`, `add_to_cart`, `purchase`. | Blind operations: no visibility into marketing conversion, traffic sources, or drop-offs. | Implement structured e-commerce dataLayer / analytics events. | 4-6 hrs |

---

## 5. Security Findings & Recommendations

### 5.1 Authentication & Session Invalidation
- **Strengths:** 
  - Passwords hashed using bcrypt with salt rounds 12 (`src/lib/auth.ts:16`).
  - Passwords validated for length and complexity before hashing.
  - JWT tokens include `sessionVersion`, which is checked against the database on each request via `getUserFromRequest` (`src/lib/utils.ts:99`). This allows instant global session invalidation when a user changes passwords or is deactivated.
  - SMS OTP uses timing-safe HMAC SHA-256 with secret keys, 60s cooldown, and 5-minute expiry (`src/lib/otp.ts`).
  - `POST /api/auth/register` hardcodes `role: 'customer'`, preventing role manipulation during registration.
- **Vulnerabilities & Gaps:**
  - **`proxy.ts` is inactive:** Because Next.js expects `middleware.ts`, security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) are currently **not sent to clients**.
  - **Hardcoded Admin Credentials in `seed.ts`:** `admin@khatikhadyo.com` / `admin123` must be removed or guarded against execution in non-dev environments.
  - **`JWT_SECRET` & `OTP_SECRET` Checks:** While runtime checks ensure length >= 32, there is no startup assertion preventing build completion if secrets are weak.

---

## 6. Payment & Checkout Readiness (SSLCOMMERZ)

### 6.1 What is Working Well
- **Validation Server API Verification:** `validateSSLCommerzTransaction` queries SSLCOMMERZ validator API (`/validator/api/validationserverAPI.php`) with `val_id` to confirm transaction status.
- **Hash Signature Verification:** `verifySSLCommerzSignature` computes MD5 hash of callback parameters against `store_passwd` using `crypto.timingSafeEqual` (`src/lib/sslcommerz.ts:152`).
- **Amount & Order Match:** Callback verifies `Math.abs(validatedAmount - order.totalAmount) < 0.01` before marking paid.
- **Audit Logging:** Payment events and status transitions are recorded in `AuditLog` table.

### 6.2 Critical Checkout & Payment Deficiencies
1. **Inventory Leak on Failure/Cancel:** Stock decremented at order placement is never restored on payment failure or cancellation.
2. **Ghost Pending Orders:** Orders created with `paymentMethod: 'online'` remain in `paymentStatus: 'pending'` and `orderStatus: 'pending'` indefinitely if the customer closes the browser on the gateway page. No automated cron or timeout marks them expired or releases inventory.
3. **Cart Threshold Conflict:** Cart page calculates free shipping against `500 BDT`, while order API enforces `1500 BDT`.

---

## 7. Database & Prisma Findings

### 7.1 Schema Architecture
- The schema (`schema.prisma`) is well-normalized with 33 models covering core commerce, dynamic homepage sections, coupons, reviews, loyalty points, delivery labels, and print queues.
- Indexes are properly defined on foreign keys (`userId`, `productId`, `orderId`) and status columns (`orderStatus`, `isActive`).

### 7.2 Database Operations Risks
- **`--accept-data-loss` in package.json:** Running `npm run db:push` will overwrite schema without interactive confirmation, creating high data loss danger.
- **Committed SQLite DB Files:** `1/db/custom.db`, `1/prisma/dev.db`, and `1/prisma/db/custom.db` should be removed from git tracking and added to `.gitignore`.
- **Transaction Safety:** Order placement uses `db.$transaction`, ensuring atomic order items creation and stock deductions.

---

## 8. Testing Gaps

| Test Category | Current State | Required Coverage | Priority |
|:---|:---:|:---|:---:|
| **Unit Tests** | 0% (None) | Currency formatting, discount calculation, smart address packing/unpacking, coupon rules | **P0** |
| **API Contract Tests** | 0% (None) | Auth flows (register/login/me), Cart additions/removals, Order validation, Payment callbacks | **P0** |
| **Integration Tests** | 0% (None) | Order creation with stock decrement & rollback on failure, SSLCOMMERZ signature check | **P0** |
| **E2E Tests** | 0% (None) | Guest checkout flow, Registered user checkout, Admin product update, Mobile navigation | **P1** |

---

## 9. Performance, Accessibility, SEO, Analytics & Deployment

### 9.1 Performance
- **Monolithic Components:** `Navbar.tsx` (1,767 lines) and `CheckoutPage.tsx` (1,227 lines) have excessive re-render scopes. Splitting into focused subcomponents will improve render speed.
- **Client Bundle Size:** Because all customer pages are loaded within `src/app/page.tsx`, even with `React.lazy`, routing overhead and hydration costs are concentrated on a single client boundary.
- **Images:** `sharp` is installed, and Cloudinary URLs utilize `f_auto,q_auto`. However, `next.config.ts` only allows `res.cloudinary.com`.

### 9.2 Accessibility (a11y)
- Product cards lack keyboard accessibility (`<Card onClick={...}>` without `role="button"` or `tabIndex="0"`).
- Contrast ratio between muted text and background in dark mode requires verification against WCAG AA standards.

### 9.3 SEO & Metadata
- **Root Layout Metadata:** Static OpenGraph and Twitter tags exist in `src/app/layout.tsx`.
- **Dynamic Product SEO:** Impossible under current SPA architecture. Products cannot be crawled or shared with custom OpenGraph tags on Facebook/WhatsApp because `/products/[slug]` does not exist as a server-rendered route.
- **Sitemap Discrepancy:** `sitemap.ts` emits URLs that 404 in production.

### 9.4 Analytics
- Zero tracking pixels or analytics events are configured. Standard e-commerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`) must be instrumented.

---

## 10. Prioritized Development Roadmap

### 🔴 Phase 1: Blockers & Security (Immediate Approval Required)
1. **Fix Ghost Dependency:** Add `"jose": "^5.9.6"` to `package.json` dependencies.
2. **Rename Middleware:** Rename `src/proxy.ts` to `src/middleware.ts` to activate HTTP security headers (CSP, HSTS, XSS protection).
3. **Fix Stock Leak on Payment Failure:** Update `src/app/api/payments/sslcommerz/handler.ts` and `src/lib/payment-sync.ts` to automatically increment product stock when payment is cancelled or failed.
4. **Remove Dangerous Database Script:** Strip `--accept-data-loss` from `package.json` `"db:push"`.
5. **Untrack Committed SQLite Files:** Add `*.db`, `*.sqlite` to `.gitignore` and untrack `1/db/custom.db`, `1/prisma/dev.db`, `1/prisma/db/custom.db`.
6. **Harmonize Delivery Threshold:** Unify SiteConfig key names and defaults between `cart/route.ts` and `orders/route.ts` (consistent threshold and fee).
7. **Harden `seed.ts`:** Prevent seed script from executing in production and eliminate hardcoded default admin credentials.

### 🟡 Phase 2: Core Commerce Functionality & Route Migration
1. **Migrate SPA to Real App Router Segments:**
   - Create `app/(store)/products/page.tsx`
   - Create `app/(store)/products/[slug]/page.tsx` (with dynamic `generateMetadata` for WhatsApp/FB sharing)
   - Create `app/(store)/cart/page.tsx`
   - Create `app/(store)/checkout/page.tsx`
   - Create `app/(store)/orders/[id]/page.tsx`
   - Create `app/(store)/policies/[slug]/page.tsx`
2. **Implement Expired Online Checkout Cleanup:** Background job or webhook to expire pending online orders older than 30 minutes and restore inventory.
3. **Cloudflare R2 / S3 Storage Adapter:** Implement cloud object storage adapter in `src/lib/storage.ts` so uploads never rely on ephemeral serverless disk.
4. **Order Receipt & Thermal Print Queue:** Complete PDF generation worker for invoices and delivery labels.

### 🟢 Phase 3: Quality, Performance, SEO & Analytics
1. **Automated Testing Suite:** Set up Vitest for unit/integration tests and Playwright for core customer checkout flows.
2. **CI/CD Pipeline:** Configure GitHub Actions workflow for PR checks (lint, typecheck, tests, build).
3. **Dynamic SEO & Sitemap Alignment:** Ensure sitemap reflects real App Router URLs and inject Schema.org JSON-LD structured data on product pages.
4. **Analytics Implementation:** Integrate GA4 / Google Tag Manager with e-commerce dataLayer events.
5. **Component Refactoring:** Decompose `Navbar.tsx` (1,767 lines) and `CheckoutPage.tsx` (1,227 lines) into testable subcomponents.

### ⚪ Phase 4: Optional Improvements
1. **NextAuth Migration:** Upgrade to Auth.js v5 (`@auth/nextjs`) or fully remove the unused `next-auth` v4 package.
2. **Dark Mode Fine-Tuning:** Enhance contrast tokens for dark mode in `globals.css`.
3. **Multi-carrier Courier Integration:** Implement API webhooks for Bangladeshi couriers (Pathao, Steadfast, RedX).

---

## 11. “Do Not Change Yet” List

The following components and configurations **must not be touched** until Phase 1 blockers are approved and executed:
- **`src/lib/bangladesh-locations.ts` & `src/lib/bangladesh-address.ts`:** Working accurately for Bangladesh divisions, districts, and address packing.
- **`src/lib/otp.ts`:** Timing-safe HMAC hashing and cooldown architecture is sound.
- **`prisma/schema.prisma` Models & Relations:** Well-structured; no migrations should be run until production database requirements are set.
- **`src/lib/sslcommerz.ts` Hash Verification:** Crypto signature verification and IPN validation logic is solid.
- **Production Code Files:** No manual code edits should be committed until the prioritized Phase 1 items are systematically approved.
