# Phase 1B Implementation Report: Payment & Inventory State Machine
**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Implementation Date:** 2026-11-01  
**Branch:** `phase-1b-implementation`  
**Engineer:** Antigravity AI Senior Architect  
**Status:** Successfully Implemented, Tested & Verified  

---

## 1. Overview & Objectives

Phase 1B implements an atomic, idempotent payment and inventory state machine for Khati Khadyo, eliminating artificial stock exhaustion and race conditions:
1. **30-Minute Inventory Reservation:** Online checkouts reserve inventory and record `reservationExpiresAt = now() + 30m`.
2. **Authoritative SSLCOMMERZ IPN Validation:** Only server-to-server IPN callbacks with verified signatures and validation API confirmation can mark orders `paid` and finalize reserved inventory.
3. **Atomic Rollback on Failure/Cancel/Expiry:** Payment failures, cancellations, invalid transactions, and 30-minute reservation timeouts trigger an atomic database transaction that updates order status, restores stock exactly once, releases coupons, and records audit logs.
4. **Race Condition & Idempotency Safeguards:** Dual events (e.g. concurrent browser cancel and IPN cancel, or duplicate IPN retries) are strictly idempotent and never double-restore stock, double-decrement coupons, or duplicate status histories.
5. **Universal Expiry Cron Endpoint:** Protected endpoint (`/api/cron/expire-pending-orders`) supporting any scheduler provider via `CRON_SECRET`.
6. **Pre-Implementation Test Suite:** Verified across all 7 required scenarios.

---

## 2. Schema Changes & Migration Requirements

### 2.1 Prisma Schema Modifications (`prisma/schema.prisma`)
The `Order` model was extended with three dedicated state tracking fields and associated performance indexes:
```prisma
model Order {
  // Existing fields ...
  couponCode            String?
  reservationExpiresAt  DateTime?              // Expiry timestamp for pending online checkout reservation (30 mins)
  stockReserved         Boolean   @default(true) // True while product inventory is reserved; False once restored or finalized
  couponReleased        Boolean   @default(false)// True once coupon usage reservation has been reversed/released
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Indexes:
  @@index([userId])
  @@index([orderStatus])
  @@index([createdAt])
  @@index([reservationExpiresAt])
  @@index([paymentStatus])
}
```

### 2.2 SQL Migration (`prisma/migrations/20261101145600_add_order_reservation_fields/migration.sql`)
```sql
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "reservationExpiresAt" TIMESTAMP(3),
ADD COLUMN "stockReserved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "couponReleased" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Order_reservationExpiresAt_idx" ON "Order"("reservationExpiresAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
```

### 2.3 Deployment Migration Instructions
To apply this schema change to production or staging databases safely without data loss:
```bash
npm run db:deploy
# Executes: prisma migrate deploy
```

---

## 3. Payment & Inventory State Machine Architecture

```
                       [Customer Places Online Order]
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │ Atomic Stock Decrement (stock: gte qty)  │
                │ reservationExpiresAt = now() + 30m       │
                │ stockReserved = true                     │
                │ paymentStatus = 'pending'                │
                └────────────────────┬─────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
                 ▼                                       ▼
    [Valid SSLCOMMERZ IPN]                 [Fail / Cancel / 30m Expiry]
                 │                                       │
                 ▼                                       ▼
┌─────────────────────────────────┐     ┌─────────────────────────────────┐
│ IPN Verification:               │     │ Atomic Rollback Transaction:    │
│ - Signature check (MD5)         │     │ - Check: stockReserved === true │
│ - Validation API (val_id)       │     │ - Restore stock (increment qty) │
│ - Amount matching check         │     │ - Release coupon (decrement qty)│
│                                 │     │ - stockReserved = false         │
│ Finalize:                       │     │ - couponReleased = true         │
│ - paymentStatus = 'paid'        │     │ - paymentStatus = fail/cancel/exp│
│ - orderStatus = 'confirmed'     │     │ - orderStatus = 'cancelled'     │
│ - reservationExpiresAt = null   │     │ - Record StatusHistory & Audit  │
└─────────────────────────────────┘     └─────────────────────────────────┘
```

### 3.1 Idempotency Rules
1. **Stock Restoration:** Before executing `increment`, the transaction checks `order.stockReserved === true` and `order.paymentStatus !== 'paid'`. If already false, the operation exits immediately as a no-op (`alreadyReleased: true`).
2. **Coupon Release:** Guarded by `order.couponReleased === false`. Once released, it is flipped to `true` and cannot decrement `usedCount` again.
3. **Paid Orders Are Immutable:** Once marked `paid` by authoritative IPN, subsequent browser fail redirects or delayed callbacks are prohibited from downgrading the order or restoring stock (`payment-sync.ts`).

---

## 4. Test Results

Automated tests were written before implementation in [`tests/payment-inventory.test.mjs`](file:///Users/nasimp/Desktop/11111/1/tests/payment-inventory.test.mjs) using Node.js's native test runner (`node:test` and `node:assert/strict`).

### 4.1 Test Execution Summary
- **Command:** `npm test`
- **Total Tests:** 7
- **Passed:** 7 (100%)
- **Failed:** 0
- **Duration:** 85.6ms

### 4.2 Detailed Test Case Verifications
1. **Scenario 1 (Successful Payment):**
   - Stock decremented on order placement (10 → 8).
   - Valid IPN finalizes payment: `paymentStatus = 'paid'`, `orderStatus = 'confirmed'`, `reservationExpiresAt = null`.
   - Stock remains at 8 (zero stock restoration on success).
2. **Scenario 2 (Failed Payment):**
   - Payment failure triggers rollback: stock restored (7 → 10), coupon `usedCount` decremented (2 → 1).
   - Order marked `cancelled`, `stockReserved = false`.
3. **Scenario 3 (Cancelled Payment):**
   - Customer gateway cancellation triggers rollback: stock restored (9 → 10), order marked `cancelled`.
4. **Scenario 4 (30-Minute Expiry Cron):**
   - Stale order with past `reservationExpiresAt` swept by cleanup cron.
   - Stock restored (6 → 10), order marked `expired` / `cancelled`.
5. **Scenario 5 (Duplicate IPN Delivery):**
   - First IPN confirms payment; second identical IPN detects `alreadyPaid: true` and makes zero duplicate database or history updates.
6. **Scenario 6 (Concurrent Race Condition):**
   - Browser cancel redirect and IPN cancel callback executed simultaneously via `Promise.all`.
   - Exactly one operation restored stock; the second exited idempotently. Final stock restored exactly once (10, not 12).
7. **Scenario 7 (Low-Stock Concurrency & Oversell Protection):**
   - Product with stock = 2 checked out by two concurrent customers requesting 2 units each.
   - Exactly one customer succeeded; the other received insufficient stock error. Stock reached exactly 0 and never went negative.

---

## 5. Protected Expiry Cron Endpoint

### 5.1 Endpoint Specification
- **Path:** `/api/cron/expire-pending-orders`
- **Methods:** `POST`, `GET`
- **Authentication:** Protected via `CRON_SECRET` environment variable.
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Or Header: `x-cron-secret: <CRON_SECRET>`
  - Or Query: `?secret=<CRON_SECRET>`

### 5.2 Deployment Scheduler Setup Instructions

#### Option A: Vercel Cron (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/expire-pending-orders",
      "schedule": "*/10 * * * *"
    }
  ]
}
```
*Note: In Vercel, set `CRON_SECRET` in Project Environment Variables. Vercel automatically includes `Authorization: Bearer <CRON_SECRET>` on cron requests.*

#### Option B: GitHub Actions Workflow (`.github/workflows/order-cleanup.yml`)
```yaml
name: Expire Stale Checkouts
on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Cleanup
        run: |
          curl -s -X POST "https://your-domain.com/api/cron/expire-pending-orders" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

#### Option C: Standard Linux Crontab / Self-Hosted VPS
```bash
# Run every 10 minutes
*/10 * * * * curl -s -X POST "https://your-domain.com/api/cron/expire-pending-orders" -H "Authorization: Bearer YOUR_CRON_SECRET" > /dev/null 2>&1
```

#### Option D: Google Cloud Scheduler
- **Frequency:** `*/10 * * * *`
- **Target:** HTTP
- **URL:** `https://your-domain.com/api/cron/expire-pending-orders`
- **HTTP Method:** `POST`
- **HTTP Headers:** `Authorization: Bearer <CRON_SECRET>`

---

## 6. Verification Status

- **Typecheck:** `npx tsc --noEmit` — 0 Errors (Exit code 0)
- **Linting:** `npm run lint` — 0 Errors (Exit code 0)
- **Unit & State Machine Tests:** `npm test` — 7/7 Passed (Exit code 0)
- **Security Headers Check:** `npm run verify:headers` — 7/7 Passed (Exit code 0)
- **Production Standalone Build:** `npm run build` — Compiled successfully in 4.6s, all 43 routes generated (Exit code 0).
