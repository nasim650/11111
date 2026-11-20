# Order Database Audit Report

## Scope

This audit covered the checkout transaction, order lifecycle API, customer order authorization and timeline, COD/payment state handling, receipt access, Prisma schema, and available automated tests. Production writes, database resets, destructive migrations, and real customer workflows were not executed.

## Findings

### Checkout and database connection

- Prisma schema validation succeeds.
- The application uses a shared Prisma client with development reuse in `src/lib/db.ts`.
- The checkout route validates the authenticated customer, address ownership, products, prices, stock, shipping, coupons, and loyalty points before creating the order.
- Order creation, stock deduction, order items, online payment creation, cart clearing, delivery label, status history, and loyalty redemption are transaction-scoped.
- A live production connectivity test was not run because the available environment file contains real credentials and destructive/write testing is prohibited without an isolated database.

### Bugs repaired

1. Coupon application consumed usage before checkout. Coupon preview now has no side effects.
2. Checkout coupon usage was vulnerable to concurrent quota claims. Checkout now performs an optimistic conditional usage claim inside the transaction.
3. Loyalty redemption could race and overdraw a balance. Redemption now uses a conditional atomic decrement.
4. Admin status options and API transitions disagreed. The API now uses the existing `pending → confirmed → processing → packed → ready_to_ship → shipped → delivered` flow.
5. Customer timeline omitted `confirmed`, `packed`, and `ready_to_ship`. These states are now displayed.
6. Cancellation previously updated order status, history, inventory, coupon usage, and delivery-label state in separate operations. These related mutations now execute in one transaction.
7. Customer order details now load status history from the database and use its timestamps instead of fabricated transition dates.

### COD and payment

COD orders are created with `paymentMethod = cod` and `paymentStatus = pending`. Online payments remain handled by the existing SSLCOMMERZ/IPN flow. No code change marks COD orders paid automatically.

### Authorization

Customer order access is ownership-checked server-side. Guest access uses the existing opaque token cookie. Admin/manager access is separate. Payment details are filtered before customer responses.

### Receipts and invoices

The existing customer order page provides browser print/save invoice behavior, and the admin order UI provides printable delivery-label output. No separate server-generated PDF receipt endpoint was found. This remains a product limitation rather than an invented test success.

## Post-fix verification

- The isolated SQLite-backed checkout workflow completed all 7 `orders-create-hardening` tests:
  authenticated COD checkout, smart address persistence, guest checkout, stock rollback, duplicate guest identity handling, guest verification rejection, and invalid-user handling.
- The customer order authorization suite completed all 11 tests, including ownership isolation, guest access, payment callback safety, and secret filtering.
- The focused lifecycle test completed successfully for `confirmed`, `processing`, `packed`, `ready_to_ship`, `shipped`, and `delivered`; each status was independently retrieved through the customer-facing order API.
- The production Next.js build completed successfully.
- Security header verification completed successfully.
- The full test command executed its assertions successfully through the available suites, but the process did not exit because existing test files leave Prisma clients open; the timeout wrapper therefore returned exit code 142. This is a test-runner cleanup issue, not a reported assertion failure.

## Validation

- TypeScript: PASS
- ESLint on changed files: PASS
- Prisma schema validation: PASS
- Diff whitespace check: PASS
- Checkout integration tests: PASS (7 assertions)
- Customer order authorization tests: PASS (11 assertions)
- Admin-to-customer lifecycle verification: PASS (6 transitions)
- Production build: PASS
- Security header verification: PASS
- Repository-wide test process exit: BLOCKED by open Prisma handles in existing tests
- Live PostgreSQL connectivity and write workflow: BLOCKED; Docker is installed but its daemon is unavailable, and no isolated PostgreSQL endpoint was supplied
- Playwright E2E: NOT RUN; no configured Playwright test command was identified

## Deployment readiness

**NOT READY FOR DEPLOYMENT** until an isolated PostgreSQL integration run passes and exposed credentials in the local `.env` are rotated. The application-level checkout and lifecycle checks pass against the repository's isolated SQLite test database.
