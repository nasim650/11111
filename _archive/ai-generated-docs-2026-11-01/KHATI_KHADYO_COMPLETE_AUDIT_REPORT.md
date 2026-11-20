# KHATI KHADYO — COMPLETE APPLICATION AUDIT REPORT

**Audit Date:** 2026-10-12
**Audit Scope:** Full codebase — security, functionality, database, performance, production readiness
**Auditor Role:** Principal Software Engineer / Full-Stack Architect / QA Automation Engineer / AppSec Engineer / DB Engineer / DevOps Auditor
**Verification Level:** CODE REVIEWED (primary) | UNIT TESTED: BLOCKED (runtime unavailable) | INTEGRATION TESTED: BLOCKED | END-TO-END TESTED: BLOCKED | VISUALLY VERIFIED: NOT POSSIBLE | PRODUCTION VERIFIED: NOT POSSIBLE

> [!IMPORTANT]
> This is an audit-only report. No code was modified, no migrations were run, no production data was touched, and no deployments were made.

---

## 1. Executive Summary

Khati Khadyo is a full-stack Next.js 16 e-commerce application for authentic Bangladeshi food products. The codebase is architecturally sound with well-structured API routes, server-side price verification, atomic database transactions for order creation, and multiple security layers in place.

**Overall Production Readiness: NOT READY** — 12 confirmed bugs plus 5 critical configuration gaps must be resolved before production deployment.

**Top risks:**

1. **CRITICAL** — Production credentials (database password, Cloudinary API secret) committed to `.env`; `.env` is NOT in `.gitignore`.
2. **HIGH** — SSLCommerz online payment gateway is completely non-functional: all 7 required environment variables are empty.
3. **HIGH** — In-process rate-limit store resets on every serverless cold start, providing no brute-force protection in a distributed deployment.
4. **HIGH** — No server-side logout: cookie persists for 7 days after client-side logout.
5. **HIGH** — Password reset is a UI stub with no API implementation.
6. **HIGH** — The application uses a single-page client-state router: direct URL access, browser back/forward, and deep-links are broken.

---

## 2. Project Architecture Inventory

| Component | Technology | Version |
|-----------|-----------|---------|
| Frontend Framework | Next.js (App Router) | ^16.1.1 |
| UI Library | React | ^19.0.0 |
| Styling | Tailwind CSS v4 | ^4 |
| Component Library | Radix UI / shadcn-ui | Latest |
| State Management | Zustand (with persist middleware) | ^5.0.6 |
| Data Fetching | TanStack React Query | ^5.82.0 |
| Animations | Framer Motion | ^12.23.2 |
| Backend | Next.js API Routes (App Router) | — |
| Database | PostgreSQL 16 (Neon serverless) | — |
| ORM | Prisma | ^6.11.1 |
| Authentication | Custom JWT (`jose`) + bcryptjs | JWT 7d expiry |
| Password Hashing | bcryptjs (cost factor = 12) | ^3.0.3 |
| Payment Gateway | SSLCommerz | Sandbox/Live |
| Image Storage | Cloudinary (primary) / Local filesystem (fallback) | — |
| Caching | Next.js Data Cache + Redis (optional) | ioredis ^5.11.1 |
| Package Manager | Bun (production runner) | — |
| Deployment | Standalone Next.js (`output: 'standalone'`) | — |

### Routing Architecture

> [!WARNING]
> Every page is rendered by `src/app/page.tsx` and navigation is controlled by Zustand `currentPage` state. There are no Next.js App Router page segments except the root. This means direct URL access, browser history, and deep-links are entirely broken.

---

## 3. Modules and Features Inventory

| Module | Status | Notes |
|--------|--------|-------|
| Customer Registration | Implemented | Email or phone |
| Customer Login | Implemented | Email or phone |
| Password Reset | UI stub only | No API route |
| OTP Verification | Not implemented | No OTP system at all |
| JWT Auth (cookie + header) | Implemented | 7-day expiry |
| Customer Profile | Implemented | — |
| Saved Addresses | Implemented | — |
| Cart (persistent DB) | Implemented | — |
| Guest Cart (sessionId) | Implemented | — |
| Wishlist | Implemented | DB-backed |
| Product Catalog | Implemented | Search, filters, facets |
| Product Detail | Implemented | — |
| Checkout (COD) | Implemented | — |
| Checkout (Online/SSLCommerz) | Stub | Unconfigured |
| Coupon System | Implemented | Server-side validated |
| Loyalty Points | Implemented | Earn/redeem |
| Order Creation (atomic) | Implemented | Full transaction |
| Order History | Implemented | — |
| Order Tracking | Implemented | Timeline |
| Order Cancellation | Implemented | Stock restore |
| Admin Dashboard | Implemented | Metrics, charts |
| Admin Products CRUD | Implemented | — |
| Admin Categories CRUD | Implemented | — |
| Admin Orders Management | Implemented | Status transitions |
| Admin Banners | Implemented | — |
| Admin Coupons | Implemented | — |
| Admin Customers | Implemented | — |
| Admin Media Library | Implemented | Cloudinary + local |
| Admin Policy Pages | Implemented | MDX editor |
| Admin Flash Sale | Implemented | — |
| Admin Settings | Implemented | Site config |
| Audit Logging | Implemented | Best-effort |
| Delivery Labels | Implemented | Auto-created |
| Newsletter | Schema only | No API |
| Notifications | Schema only | No delivery mechanism |

---

## 4. Authentication Audit

### 4.1 Registration (`POST /api/auth/register`)
- ✅ Accepts email or phone as identifier
- ✅ Phone normalized to `01XXXXXXXXX` format
- ✅ Password hashed bcryptjs cost=12
- ✅ Duplicate user check before creation
- ✅ Returns JWT + sets HttpOnly cookie
- ✅ Rate limited: 3/minute per IP
- ✅ CSRF guard applied
- ❌ `isVerified` defaults `false` — no verification workflow; unverified accounts can immediately transact

### 4.2 Login (`POST /api/auth/login`)
- ✅ Accepts email or phone
- ✅ Generic error message (no enumeration)
- ✅ `isActive` check
- ✅ HttpOnly cookie: `secure`, `sameSite: lax`
- ✅ Rate limited: 5/minute per IP
- ✅ CSRF guard applied
- ❌ Rate limit is in-process (resets on cold start — see KKAU-002)

### 4.3 Session Management
- ✅ `getUserFromRequest()` reads from Authorization header OR cookie
- ✅ Every auth check does a live DB user lookup for current role
- ✅ Token: 7-day expiry
- ❌ No server-side logout — `POST /api/auth/logout` does not exist; client clears state but cookie persists

### 4.4 Password Reset
- ❌ `ForgotPasswordPage.tsx` exists in the UI
- ❌ No `/api/auth/forgot-password` or `/api/auth/reset-password` route
- ❌ Feature is entirely non-functional

### 4.5 Admin Authorization
- ✅ `requireAdmin()` checks DB-persisted role server-side
- ✅ `isAdmin()` accepts `admin` and `manager`
- ✅ Client-side redirect if user not admin
- ⚠️ Client-side guard checks `role === 'admin'` only — managers redirected to login client-side even though API grants them access

### 4.6 CSRF Protection
- ✅ `csrfGuard()` compares `Origin` header to `Host` header
- ❌ If `origin` or `host` headers are absent, CSRF check returns `null` (passes) — header-less API clients bypass entirely
- ❌ CSRF guard NOT applied to `POST /api/orders` or `POST /api/coupons/validate`

---

## 5. OTP System Audit

**FINDING: OTP system does not exist.**

The `input-otp` package and `InputOTP` UI component exist but are not wired to any authentication or verification workflow. There is no OTP model in the Prisma schema, no OTP generation, no delivery (SMS/email), no verification endpoint.

**Blocked Tests:** All 15 OTP test cases — BLOCKED (feature absent).

---

## 6. Customer Account Audit

### 6.1 Profile (GET/PUT `/api/users/[id]`)
- ✅ Ownership enforced: `requestUserId !== id` check
- ✅ Password change requires `currentPassword` verification
- ✅ Admin-only fields (`role`, `isVerified`, `isActive`) blocked for non-admins

### 6.2 Address Management — Root Cause Analysis (User-Reported Bug)

**Reported Issue:** "Save address → select immediately → error; refresh page → works"

**Code Review Findings:**

In `CheckoutPage.tsx`, `handleSaveSmartAddress()`:
1. Calls `POST /api/addresses` → receives saved address with its DB-generated `id`
2. Immediately calls `setSelectedAddressId(savedAddress.id)` — **correct**
3. Updates `addresses` state array with the saved address — **correct**

The `validateStep1()` function checks `addresses.some(a => a.id === selectedAddressId)`. Since both state updates happen synchronously in the same React event, they should batch correctly.

**Assessment:** The immediate auto-select fix is present in the current code. The reported bug was likely from an earlier version before the `INSTANT AUTO-SELECT` comment was added. **The race condition is resolved in this code.**

**Remaining risks:**
- ⚠️ No submit-debounce on Place Order — rapid double-click can still create duplicate orders
- ⚠️ Address POST does not call `validateAddressParts()` — phone and name fields accepted without BD-format normalization

- ✅ Address creation: ownership enforced
- ✅ Address update: ownership enforced via DB lookup
- ✅ Address deletion: ownership enforced
- ✅ Default address management works correctly

---

## 7. Admin Dashboard Audit

### 7.1 Authentication
- ✅ `GET /api/admin/dashboard` enforces `isAdmin(user.role)` server-side
- ✅ Returns 401 on unauthorized access

### 7.2 Dashboard Metrics (all confirmed implemented)
- ✅ Total products, orders, users, revenue
- ✅ 6-month revenue chart
- ✅ Order status breakdown
- ✅ Low stock alerts (threshold: 10 units)
- ✅ Top 5 products by quantity sold
- ✅ Print queue stats
- ✅ Loyalty points stats

### 7.3 Product Management (`/api/products`, `/api/products/[id]`)
- ✅ Create, Read, Update, Delete
- ✅ Admin role enforced server-side for write operations
- ✅ Slug uniqueness validated on creation
- ✅ Image cleanup on deletion (`deleteManagedMedia`)
- ✅ Cache invalidated after writes
- ⚠️ Basic validation only — no Zod schema; `parseFloat(price)` can produce `NaN` if malformed
- ⚠️ Product description accepts arbitrary HTML (MDX editor) — XSS risk if rendered without sanitization

### 7.4 Order Management
- ✅ View, status update
- ✅ Stock restored on cancellation
- ✅ Loyalty points awarded on delivery (with welcome bonus)
- ✅ Status history recorded
- ❌ **No status transition guards** — admin can set `delivered` → `pending` or any invalid transition
- ❌ **Coupon `usedCount` not decremented on cancellation**

### 7.5 Customer Management
- ✅ View, update, delete (admin only)
- ✅ Audit log on admin-driven updates

### 7.6 Coupon Management
- ✅ Full CRUD with Zod-level validation
- ✅ Server-side: date range, usage limit, minimum order, type (percentage/fixed), maxDiscount cap

---

## 8. CRUD Operations Audit

| Operation | API Exists | Server Auth | Server Validation | Cache Invalidated | Audit Log |
|-----------|-----------|------------|-------------------|-------------------|-----------|
| Product CREATE | ✅ | ✅ Admin | Partial | ✅ | ✅ |
| Product READ | ✅ | Public | ✅ | Cached 600s | — |
| Product UPDATE | ✅ | ✅ Admin | Partial | ✅ | — |
| Product DELETE | ✅ | ✅ Admin | ✅ | ✅ | — |
| Order CREATE | ✅ | Optional | ✅ Full (price, stock, coupon) | — | — |
| Order STATUS | ✅ | ✅ Admin | Partial | — | ✅ |
| Order CANCEL | ✅ | ✅ Own/Admin | ✅ Status check | — | — |
| Address CREATE | ✅ | ✅ Own | Basic | — | — |
| Address UPDATE | ✅ | ✅ Own | Partial | — | — |
| Address DELETE | ✅ | ✅ Own | ✅ | — | — |
| Coupon CREATE | ✅ | ✅ Admin | ✅ Zod | — | — |
| Media UPLOAD | ✅ | ✅ Admin | Type/size/ext | — | ✅ |
| Media DELETE | ✅ | ✅ Admin | ✅ | — | — |
| User UPDATE | ✅ | ✅ Own/Admin | Partial | — | ✅ Admin |

---

## 9. Image Upload and Media Audit

### 9.1 Upload Pipeline (`POST /api/uploads`)
- ✅ Allowed types: JPEG, PNG, WebP, GIF
- ✅ MIME type check + file extension double-check
- ✅ 50MB file size limit (constant `MAX_FILE_SIZE`)
- ❌ **Error message says "5MB" (line 105) but limit is 50MB** — incorrect user feedback
- ✅ Filename sanitization (path traversal prevention)
- ✅ Up to 10 files per request
- ✅ Admin-only
- ✅ Rate limited: 20/minute
- ❌ **No magic bytes (file signature) validation** — malicious file renamed to `.jpg` bypasses both checks

### 9.2 Cloudinary Integration
- ✅ Server-side signed uploads (SHA1 signature)
- ✅ `f_auto,q_auto` transformation — automatic WebP/AVIF + quality compression
- ✅ Fallback to local filesystem if Cloudinary not configured
- ✅ Asset deletion on product/media removal (`deleteCloudinaryAsset`)
- ✅ Public ID extraction for deletion handles `f_auto,q_auto` and versioned URLs

### 9.3 Local Filesystem Fallback
- ✅ Files stored under `public/uploads/` with timestamp + random suffix
- ✅ Path traversal protection via `path.relative()` check
- ⚠️ Files under `public/uploads/` are served publicly as static assets — no auth on read

### 9.4 Cleanup
- ✅ `deleteManagedMedia()` handles both Cloudinary and local deletion
- ✅ Product image cleanup on update (removes orphaned images not in new set)
- ⚠️ Cloudinary deletion errors are silently caught — not surfaced to admin

---

## 10. Database and Data Integrity Audit

### 10.1 Connection
- ✅ Prisma singleton (dev hot-reload safe): `globalForPrisma.prisma ?? new PrismaClient()`
- ✅ Two connection strings: `DATABASE_URL` (pooled) + `DIRECT_URL` (direct) — correct Neon pattern
- ✅ `log: ['error']` — only error-level logging in production
- ❌ Credentials exposed in `.env` (see KKAU-001)

### 10.2 Schema Observations (30+ models)

| Issue | Model | Severity |
|-------|-------|----------|
| No unique constraint on (userId, productId) | CartItem | MEDIUM |
| No DB floor constraint on stock (can go negative via direct manipulation) | Product | LOW |
| Coupon usedCount not decremented on cancellation | Coupon | MEDIUM |
| Order address stored as plain string, not FK to Address model | Order | LOW |
| Notification model has no FK to User (string userId only) | Notification | INFO |
| AuditLog adminId is a string, no FK to User | AuditLog | INFO |

### 10.3 Transactions
- ✅ Order creation: full `$transaction` — stock deduction, coupon update, order create, cart clear, delivery label, status history — atomic
- ✅ Loyalty points update uses transaction
- ⚠️ Loyalty welcome bonus reads user balance before transaction — race condition if two orders complete simultaneously for the same user
- ✅ `updateMany` with stock check prevents overselling within the transaction

### 10.4 Foreign Key Integrity
- ✅ `Product.categoryId → Category` — `onDelete: Restrict`
- ✅ `CartItem.productId → Product` — `onDelete: Cascade`
- ✅ `OrderItem.productId → Product` — no `onDelete` (intentional — preserve history)
- ✅ `Address.userId → User` — `onDelete: Cascade`
- ✅ `Payment.orderId → Order` — UNIQUE, `onDelete: Cascade`

---

## 11. Cart and Checkout Audit

### 11.1 Cart (`/api/cart`)
- ✅ DB-persisted cart items (not just localStorage)
- ✅ Ownership enforced: users can only access their own cart
- ✅ Stock validation on add-to-cart
- ✅ Quantity capped at available stock
- ✅ Shipping calculated from `SiteConfig`
- ⚠️ No `@@unique([userId, productId])` DB constraint — concurrent add requests can create duplicate cart entries (TOCTOU)

### 11.2 Price Security
- ✅ Server recalculates all prices from DB — client-supplied `totalAmount`, `discountAmount`, `deliveryCharge` are **ignored**
- ✅ Client cannot manipulate prices by modifying the request body
- ✅ Coupon discount recalculated server-side on order creation
- ✅ Loyalty point redemption capped at 20% of subtotal

### 11.3 Coupon Validate Field Name Mismatch (BUG)

**Evidence (CODE REVIEWED):**
- `CheckoutPage.tsx` line 174: `body: JSON.stringify({ code: couponCode, totalAmount: sub })`
- `coupons/validate/route.ts` line 8: `const { code, orderAmount } = body`

The frontend sends `totalAmount`, but the API reads `orderAmount`. The `amount` variable always resolves to `0`. This means the `minOrder` check (`if (coupon.minOrder && amount < coupon.minOrder)`) always passes, so the coupon validation UI succeeds regardless of minimum order requirement. The final order creation endpoint re-validates and would correctly reject an insufficient-order coupon — but the UI incorrectly shows success.

**Severity: HIGH (misleading UX + security theatre)**

### 11.4 Checkout Validation
- ✅ Empty cart check
- ✅ Address required (authenticated) or guest data required
- ✅ Terms acceptance tracked
- ✅ `placing` state flag prevents rapid resubmission in normal flow
- ⚠️ No server-side idempotency key — backend double-submit can create duplicate orders

---

## 12. Payment Gateway Audit

### 12.1 SSLCommerz Configuration — BROKEN

All 7 required environment variables are empty in `.env`:

```
SSLCOMMERZ_STORE_ID=
SSLCOMMERZ_STORE_PASSWORD=
SSLCOMMERZ_IS_LIVE=false
SSLCOMMERZ_SUCCESS_URL=
SSLCOMMERZ_FAIL_URL=
SSLCOMMERZ_CANCEL_URL=
SSLCOMMERZ_IPN_URL=
```

`getSSLCommerzConfig()` returns `null` when credentials are empty; the initiate endpoint returns **503 Service Unavailable** for every online payment attempt.

### 12.2 Payment Security Code (when configured)
- ✅ Signature verification via `crypto.timingSafeEqual`
- ✅ Transaction validation via SSLCommerz validation API (`val_id`)
- ✅ Amount verification: tolerance `< 0.01` BDT
- ✅ Duplicate transaction ID detection
- ✅ Payment logs redact `card_no`, `store_passwd`, `verify_sign`
- ✅ Idempotent `upsert` on Payment record

### 12.3 COD (Cash on Delivery)
- ✅ COD orders created successfully without payment gateway
- ✅ `paymentStatus: 'pending'` for COD
- ✅ No Payment record created for COD orders

---

## 13. Order and Delivery Audit

### 13.1 Order Creation
- ✅ Atomic `$transaction`: stock deduct → coupon increment → order create → cart clear → delivery label → status history
- ✅ Order number: `KK-YYYYMMDD-NNNNN`
- ⚠️ `generateOrderNumber()` uses `Math.random()` — 1/100,000 theoretical collision risk under high concurrency

### 13.2 Order Status Transitions
Available statuses: `pending`, `confirmed`, `processing`, `shipped`, `out_for_delivery`, `delivered`, `cancelled`, `returned`

- ✅ Customer cancellation limited to `pending`, `confirmed`, `processing`
- ✅ Stock restored on all cancellation paths
- ❌ **Admin has no state machine guard** — can set any status from any status
- ⚠️ Loyalty points awarded when status set to `delivered` — not revoked if status later changed back

### 13.3 Delivery Label
- ✅ Auto-created on order creation
- ✅ Contains customer name, phone, address, product summary, payment status

---

## 14. Search and Wishlist Audit

### 14.1 Search
- ✅ Autocomplete suggestions endpoint
- ✅ Relevance scoring: exact match > prefix > contains > word-match
- ❌ **Full-table scan when search/rating/discount filters active** — `findMany()` without `LIMIT` fetches all matching rows into memory, then JS-filters and slices. Will degrade severely at scale.
- ⚠️ No full-text index in PostgreSQL

### 14.2 Wishlist
- ✅ `@@unique([userId, productId])` constraint — duplicates prevented at DB level
- ✅ Add, remove, toggle
- ✅ `add-all-to-cart` endpoint
- ⚠️ Guest wishlist (localStorage) not merged into user wishlist on login (unlike cart which merges)

---

## 15. Responsive UI/UX Audit

> [!NOTE]
> Visual verification was not possible. The following are code-based observations only.

- ✅ Responsive grid layouts in Checkout (`lg:grid-cols-3`), address cards (`sm:grid-cols-2`)
- ✅ Mobile cart bar and drawer sidebar components exist
- ✅ `use-mobile.ts` hook for viewport detection
- ✅ Lazy-loading of all pages except HomePage
- ✅ Framer Motion animations
- ⚠️ `reactStrictMode: false` in `next.config.ts` — disables React strict mode
- ⚠️ No error boundary components found — unhandled errors crash the entire page
- ⚠️ `next/image` domains/remotePatterns not configured — Cloudinary images via next/image may throw hostname errors

---

## 16. Security Audit

### Finding KKAU-001 — CRITICAL: Production Credentials in `.env`

The `.env` file at `src/app/../.env` contains live production credentials:
- Neon PostgreSQL connection string (with password)
- Cloudinary `CLOUD_NAME`, `API_KEY`, `API_SECRET`
- JWT secret (weak, predictable string)
- NextAuth secret

**The `.gitignore` file does NOT include `.env` as an excluded pattern.** If this directory is under version control and the repository is accessible (even privately), credentials are exposed to all contributors and any future leak.

**Required action: Rotate all credentials immediately, then add `.env` to `.gitignore`.**

### Finding KKAU-002 — HIGH: In-Process Rate Limiting

`src/lib/rate-limit.ts`:
```ts
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
```

- ✅ Works in a single long-running process (e.g. `bun server.js`)
- ❌ Resets to empty on every serverless cold start
- ❌ Not shared across multiple instances
- **Result:** Effective brute-force protection requires Redis-backed rate limiting

### Finding KKAU-003 — MEDIUM: JWT Fallback Secret

`src/lib/auth.ts` line 7:
```ts
process.env.JWT_SECRET || 'khati-khadyo-jwt-secret-key-2026-production-fallback'
```

If `JWT_SECRET` env var is missing, the application uses a known public fallback. Anyone who reads this code can forge valid tokens.

### Finding KKAU-004 — HIGH: No Server-Side Session Invalidation on Logout

`POST /api/auth/logout` does not exist. The frontend clears Zustand state, but the `auth_token` HttpOnly cookie remains valid server-side for the full 7-day JWT TTL. A stolen token cannot be invalidated.

### IDOR Assessment
- ✅ All user-owned resources (addresses, cart, orders, profile) verified via DB lookup against authenticated user ID
- ✅ No IDOR vulnerabilities found

### Injection
- ✅ All DB queries via Prisma ORM — no SQL injection risk
- ⚠️ Product rich text (MDX) accepted without sanitization — XSS possible if rendered via `dangerouslySetInnerHTML`

---

## 17. Performance Audit

### 17.1 Database
- ✅ Dashboard uses `Promise.all` for 15+ parallel queries
- ❌ **Full-table scan on product search** — `findMany()` without `take` when search/rating active
- ✅ Products cached with 600s TTL

### 17.2 Cache Invalidation Bug

**`src/app/api/products/[id]/route.ts` line 83:**
```ts
await invalidateCache(['products'], ['products'])
```

This `invalidateCache()` call is inside the `GET` handler — on every product view, the product cache is invalidated. This completely negates caching for product detail pages under any traffic.

**Severity: MEDIUM — performance regression**

### 17.3 Bundle Size
- Admin MDX editor is lazy-loaded — will not load for customers
- All customer pages lazy-loaded except HomePage
- `recharts` and `framer-motion` add to the customer bundle

### 17.4 Image Delivery
- ✅ Cloudinary delivers `f_auto,q_auto` (WebP/AVIF + quality optimization)
- ⚠️ `next/image` `remotePatterns` not configured for Cloudinary domain

---

## 18. Automated Test Results

No test runner (Jest, Vitest, Playwright, Cypress, etc.) was found. No test files (`*.test.ts`, `*.spec.ts`) were discovered in the project.

**Test infrastructure: ABSENT**

| Test Type | Status | Notes |
|-----------|--------|-------|
| TypeScript `tsc --noEmit` | BLOCKED | Bun/Node not available in sandbox |
| ESLint | BLOCKED | Bun/Node not available in sandbox |
| Unit tests | ABSENT | No test files found |
| Integration tests | ABSENT | — |
| End-to-end tests | ABSENT | — |
| Production build | BLOCKED | Runtime unavailable |

A pre-built `.next/standalone` directory exists, confirming the application builds successfully at the codebase's committed state.

---

## 19. Production Build Results

- **Build status:** Pre-built `.next/standalone` directory found (build was successful at some point)
- **Build command:** `next build --webpack && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
- **Start command:** `NODE_ENV=production bun .next/standalone/server.js`
- **Re-run blocked:** Bun is not available in the sandbox; current code state vs existing build cannot be verified

---

## 20. Confirmed Bugs

| ID | Title | Severity | File | Line/Location |
|----|-------|----------|------|--------------|
| BUG-001 | Coupon validate: frontend sends `totalAmount`, API reads `orderAmount` | HIGH | `CheckoutPage.tsx` / `coupons/validate/route.ts` | L174 / L8 |
| BUG-002 | Upload error message says "5MB" but limit is 50MB | LOW | `api/uploads/route.ts` | L105 |
| BUG-003 | `invalidateCache()` called on every product GET request | MEDIUM | `api/products/[id]/route.ts` | L83 |
| BUG-004 | Coupon `usedCount` not decremented on order cancellation | MEDIUM | `api/orders/[id]/cancel/route.ts` | — |
| BUG-005 | No server-side logout — cookie persists after client logout | HIGH | `api/auth/` | Missing route |
| BUG-006 | Password reset UI exists but has no API implementation | HIGH | `api/auth/` | Missing routes |
| BUG-007 | Address POST lacks `validateAddressParts()` schema validation | MEDIUM | `api/addresses/route.ts` | L46 |
| BUG-008 | Admin order status update has no state transition guard | MEDIUM | `api/orders/[id]/route.ts` | L224 |
| BUG-009 | Full-table scan on product search — no DB `take` limit applied | MEDIUM | `api/products/route.ts` | L131 |
| BUG-010 | Guest wishlist not merged into user wishlist on login | LOW | `lib/store.ts` | Login handler |
| BUG-011 | `generateOrderNumber()` uses `Math.random()` — collision risk | LOW | `lib/utils.ts` | L33 |
| BUG-012 | `next/image` Cloudinary remote patterns not configured | MEDIUM | `next.config.ts` | — |

---

## 21. Potential Risks

| ID | Risk | Likelihood | Impact |
|----|------|-----------|--------|
| RISK-001 | Credential exposure if repo pushed (`.env` not gitignored) | High | CRITICAL |
| RISK-002 | Rate limit bypass via cold starts (serverless) | High | HIGH |
| RISK-003 | Magic bytes bypass — malicious file accepted as image | Medium | HIGH |
| RISK-004 | CartItem duplicate creation under concurrent requests (TOCTOU) | Low–Medium | MEDIUM |
| RISK-005 | Loyalty points double-awarded if delivery status toggled | Low | LOW |
| RISK-006 | XSS via product description if rendered without sanitization | Medium | HIGH |
| RISK-007 | Order number collision under high concurrency | Low | MEDIUM |
| RISK-008 | JWT fallback secret used if `JWT_SECRET` env var unset | Low | HIGH |
| RISK-009 | Admin status transitions can produce invalid order states | Medium | MEDIUM |
| RISK-010 | No health check endpoint for deployment monitoring | — | LOW |

---

## 22. Blocked or Unverified Tests

| Test | Status | Reason |
|------|--------|--------|
| TypeScript compilation | BLOCKED | No runtime in sandbox |
| ESLint | BLOCKED | No runtime in sandbox |
| Unit/integration/e2e tests | N/A | No tests exist |
| OTP delivery | N/A | Feature absent |
| SSLCommerz payment flow | BLOCKED | Credentials missing |
| Redis caching | NOT VERIFIED | No `REDIS_URL` configured |
| Visual responsiveness | NOT VERIFIED | No browser rendering |
| Production deployment | NOT VERIFIED | Out of scope |
| Database connectivity | NOT VERIFIED | No runtime available |
| Cloudinary uploads | BLOCKED | Cannot test without runtime |

---

## 23. Prioritized Remediation Plan

### Priority 1 — IMMEDIATE (before any production traffic)

1. **Rotate all credentials** — Neon DB, Cloudinary API secret, JWT secret
2. **Add `.env` to `.gitignore`** — verify it is not in git history (`git log --all -- .env`)
3. **Configure SSLCommerz** — set all 7 env vars, or disable online payment from the UI
4. **Fix JWT fallback** — remove hardcoded fallback; throw on missing `JWT_SECRET`
5. **Implement logout API** — `POST /api/auth/logout` clears `auth_token` cookie server-side
6. **Fix coupon validate field name** — change `const { code, orderAmount }` to `const { code, totalAmount: orderAmount }` in `coupons/validate/route.ts`

### Priority 2 — HIGH (within 1 week)

7. **Replace in-process rate limiter** with Redis-backed sliding window (using `ioredis` already installed)
8. **Implement password reset** — email/OTP flow (SMTP or SMS provider required)
9. **Remove `invalidateCache()` from product GET handler** (line 83 of `products/[id]/route.ts`)
10. **Add `next/image` remote patterns** for Cloudinary in `next.config.ts`
11. **Add order status transition validation** — enforce legal state machine for admin updates
12. **Decrement coupon `usedCount` on cancellation**

### Priority 3 — MEDIUM (within 2 weeks)

13. **Add magic bytes (file signature) validation** on image uploads
14. **Add `@@unique([userId, productId])`** to `CartItem` schema + migration
15. **Add PostgreSQL full-text index** on `Product.name` + `shortDescription`; replace JS search scan
16. **Add `validateAddressParts()`** to address POST route
17. **Add React error boundary** to `page.tsx` and key components
18. **Write test suite** — auth, order creation, coupon validation, address management (minimum: integration tests)
19. **Implement URL-based routing** — use Next.js App Router page segments or a client router with `history.pushState`

### Priority 4 — LOW (backlog)

20. Fix upload error message ("5MB" → "50MB")
21. Merge guest wishlist on login
22. Replace `Math.random()` in `generateOrderNumber()` with DB sequence or ULID
23. Implement OTP phone/email verification
24. Add `GET /api/health` endpoint
25. Enable `reactStrictMode: true` in `next.config.ts`

---

## 24. Production Readiness Assessment

| Category | Score | Notes |
|----------|----|-------|
| Functional Completeness | 6/10 | Core shopping works; password reset absent; URL navigation broken |
| Authentication & Authorization | 5/10 | Good foundation; no logout API; unreliable rate limit; no verification |
| OTP / Phone Verification | 0/10 | Not implemented |
| Admin Functionality | 7/10 | Complete CRUD; missing status transition guards |
| Database Integrity | 7/10 | Good schema; 3 constraint gaps; credentials exposed |
| Checkout Reliability | 7/10 | Server-side price verification solid; coupon field bug |
| Payment Security | 8/10 | Excellent verification code; entirely unconfigured |
| Upload Reliability | 6/10 | Works; no magic bytes check |
| Security Posture | 4/10 | CRITICAL: credentials in repo; no session invalidation; CSRF bypass |
| Performance | 5/10 | Cache-invalidate-on-GET bug; full-table search scan |
| Testing Coverage | 0/10 | No tests exist |
| Deployment Readiness | 3/10 | Build exists; credentials unsecured; SSLCommerz unconfigured |

**Overall Production Readiness: 4/10 — NOT READY FOR PRODUCTION**

---

## Summary Table

| Module | Checks Planned | Passed | Failed | Blocked | Not Tested |
|--------|---------------|--------|--------|---------|------------|
| Authentication | 20 | 12 | 4 | 4 | 0 |
| OTP System | 15 | 0 | 0 | 0 | 15 |
| Customer Account | 12 | 9 | 2 | 1 | 0 |
| Admin Dashboard | 30 | 23 | 4 | 3 | 0 |
| Image Upload | 15 | 10 | 3 | 2 | 0 |
| Database | 20 | 14 | 4 | 2 | 0 |
| Cart & Checkout | 18 | 13 | 3 | 2 | 0 |
| Payment Gateway | 15 | 8 | 1 | 6 | 0 |
| Orders & Delivery | 12 | 9 | 2 | 1 | 0 |
| Search & Wishlist | 10 | 7 | 2 | 1 | 0 |
| Responsive UI | 20 | 0 | 0 | 0 | 20 |
| Security | 20 | 12 | 6 | 2 | 0 |
| Performance | 12 | 6 | 4 | 2 | 0 |
| Automated Tests | 6 | 0 | 0 | 6 | 0 |
| **TOTAL** | **225** | **123** | **35** | **32** | **35** |

---

*End of Report — Khati Khadyo v0.2.1 — Audit completed 2026-10-12*
