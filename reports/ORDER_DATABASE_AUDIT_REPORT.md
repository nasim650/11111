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

## Validation

- TypeScript: PASS
- ESLint on changed files: PASS
- Prisma schema validation: PASS
- Diff whitespace check: PASS
- Existing order/security suites: multiple tests passed before the repository-wide command stopped producing output and was terminated.
- Full repository test completion: BLOCKED; the command did not terminate cleanly in this environment.
- Live PostgreSQL connectivity and write workflow: BLOCKED; no isolated database was supplied.
- Production build and Playwright E2E: NOT RUN.

## Deployment readiness

**NOT READY FOR DEPLOYMENT** until the full test suite completes, an isolated PostgreSQL integration run passes, and exposed credentials in the local `.env` are rotated.
