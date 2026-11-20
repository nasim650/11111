# 🚀 Phase 2C.1: Order Detail Route Authorization & HTTP Semantics Correction Report

**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Branch:** `phase-1b-implementation`  
**Execution Date:** 2026-11-04  
**Scope:** Order Detail Authorization Hardening, Safe Login Redirect, Open Redirect Elimination, HTTP 404 Anti-Enumeration, and Cleanup of Unused Error View  

---

## 1. Skills Actually Used

In compliance with project auditing rules, each skill evaluated during this phase is documented below. Installed skills were applied directly to verify codebase contracts; skills not installed are designated as **Not Available**.

| Skill ID | Status | Purpose & Contribution | Files & Sections Audited / Implemented |
| :--- | :---: | :--- | :--- |
| `api-security-best-practices` | **Active** | Replaced 403 Forbidden with uniform HTTP 404 Not Found to prevent order-number enumeration attacks; implemented `sanitizeInternalRedirect` to block Open Redirect attacks (`//evil.com`, `/\evil.com`, CRLF injection). | `src/lib/security.ts`, `src/lib/order-authorization.ts` |
| `backend-architect` | **Active** | Architected pre-render authorization guard: unauthenticated users redirect to login before order lookup or data rendering occurs. | `src/app/orders/[orderNumber]/page.tsx` |
| `nextjs-app-router-patterns` | **Active** | Utilized Next.js 16 native `redirect()` and `notFound()` helpers for standard HTTP semantics instead of returning 200 with client error components. | `src/app/orders/[orderNumber]/page.tsx` |
| `dependency-analysis` | **Active** | Audited reference inventory across `src/` and `tests/` before safely deleting `OrderAuthErrorView.tsx`. | `src/components/pages/OrderAuthErrorView.tsx` |
| `testing-patterns` | **Active** | Authored comprehensive automated tests for login redirects, Open Redirect sanitization, cross-customer 404 isolation, and manager access. | `tests/cart-checkout-order-routes.test.mjs` |
| `api-contract-testing` | **Active** | Verified that `getOrderForUser` returns identical 404 error payload for non-existent orders and cross-customer unauthorized orders. | `src/lib/order-authorization.ts`, `tests/cart-checkout-order-routes.test.mjs` |
| `writing-guidelines` | **Active** | Documented implementation rationale, threat mitigations, and audit results in clear markdown. | Entire report |

---

## 2. Issues Identified & Corrected

### 2.1 The Problem in Phase 2C
In Phase 2C, `/orders/[orderNumber]` rendered `<OrderAuthErrorView>` on unauthenticated (401) or unauthorized (403) states. This caused two primary issues:
1. **HTTP Status 200 on Errors:** Next.js App Router rendered the custom error component within a standard HTTP 200 response rather than issuing native redirect or 404 headers.
2. **Order Existence Enumeration (Information Disclosure):** An authenticated Customer A requesting Customer B's order received an "Access Denied" (403) UI, whereas requesting a non-existent order received 404. This semantic difference allowed malicious actors to guess and enumerate valid order numbers.

### 2.2 Implemented Corrections

1. **Unauthenticated Access ➔ Safe Login Redirect (`redirect`):**
   - If `!sessionUser`, the route immediately calls Next.js `redirect('/login?next=' + encodeURIComponent(safeNext))`.
   - The redirect target is passed through `sanitizeInternalRedirect` to ensure zero Open Redirect vulnerabilities.
   - Order lookup and data serialization never execute for unauthenticated requests.

2. **Open Redirect Elimination (`src/lib/security.ts`):**
   - Added `sanitizeInternalRedirect(target, fallback = '/')`.
   - Allows only internal relative paths starting with a single `/`.
   - Strictly rejects protocol-relative URLs (`//evil.com`), backslash tricks (`/\evil.com`, `\\evil.com`), external protocols (`https://...`), `javascript:` schemes, and CRLF injection.

3. **Anti-Enumeration via Uniform 404 (`src/lib/order-authorization.ts`):**
   - When an authenticated customer attempts to access an order that does not belong to them (`!isUserAdmin && !isOwner`), the system returns `{ status: 404, error: 'Order #... not found', order: null }`.
   - `/orders/[orderNumber]/page.tsx` natively invokes `notFound()`.
   - An attacker cannot determine whether an order number exists or not.

4. **Safe Deletion of `OrderAuthErrorView.tsx`:**
   - Reference inventory confirmed zero usages outside `page.tsx`.
   - File was safely deleted, keeping the codebase clean and maintainable.

---

## 3. Payment Invariant Preservation

- **SSLCOMMERZ Handlers Untouched:** `src/app/api/payments/sslcommerz/handler.ts` remains unmodified.
- **Browser Callbacks Non-Authoritative:** Browser redirects (`success`, `fail`, `cancel`) perform zero database mutations on orders, payments, stock, or coupons.
- **IPN Authoritative Mutation:** Only validated server-to-server IPN transitions order and payment states.
- **Payment Query Hint:** `?payment=...` parameters in the URL are only displayed within `OrderDetailView` for authorized owners and administrators.

---

## 4. Test Verification Summary

Automated tests in [`tests/cart-checkout-order-routes.test.mjs`](file:///Users/nasimp/Desktop/11111/1/tests/cart-checkout-order-routes.test.mjs) verify the hardened contracts:
- `✔ 1. /cart direct route test: canonical metadata & CustomerShell wrapper`
- `✔ 2. empty cart -> checkout redirect test`
- `✔ 3. /checkout direct route test: robots noindex & CustomerShell`
- `✔ 4. unauthenticated order page -> validated login redirect`
- `✔ 5. malicious external next value -> rejected/sanitized to prevent Open Redirect`
- `✔ 6. customer A -> customer B order -> true HTTP 404 and zero order-content leak`
- `✔ 7. unknown order -> true HTTP 404`
- `✔ 8. owner -> HTTP 200 with complete authorized order details`
- `✔ 9. admin/manager -> HTTP 200 with strictly zero raw secrets leaked`
- `✔ 10. payment browser redirect causes zero database mutation test`
- `✔ 11. valid IPN payment regression test: server-to-server IPN remains sole authoritative mutator`

**Result:** All 11 route, authorization, and invariant tests passed with 100% success.
**Typecheck & Lint:** `npx tsc --noEmit` and `npm run lint` passed with 0 errors and 0 warnings.

---

## 5. Changed Files Summary

| File | Status | Description |
|---|:---:|---|
| `src/app/orders/[orderNumber]/page.tsx` | Modified | Added pre-render login redirect with sanitized `next` param; calls `notFound()` for unauthorized access. |
| `src/lib/security.ts` | Modified | Implemented `sanitizeInternalRedirect` to prevent Open Redirect attacks. |
| `src/lib/order-authorization.ts` | Modified | Returns 404 for unauthorized customer requests to eliminate enumeration attacks. |
| `src/components/pages/OrderAuthErrorView.tsx` | Deleted | Safely removed unused error component. |
| `tests/cart-checkout-order-routes.test.mjs` | Modified | Updated and expanded test suite covering redirects, sanitization, and 404 isolation. |
| `docs/PHASE_2C_1_ORDER_AUTHORIZATION_CORRECTION_REPORT.md` | New | Comprehensive documentation of Phase 2C.1 corrections and verification. |
