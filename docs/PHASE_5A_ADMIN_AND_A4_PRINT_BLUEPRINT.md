# 📋 Phase 5A: Admin Operations Dashboard & A4 Dual-Voucher Order Print Blueprint

**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Branch:** `phase-1b-implementation`  
**Execution Date:** 2026-11-04  
**Status:** Complete Architectural & Visual Print Blueprint (Analysis & Design Only — Zero Implementation / Zero Mutations)  

---

## 1. Skills Actually Used

In compliance with project auditing rules, each skill evaluated during this phase is documented below. Installed skills were applied directly to verify codebase contracts and formulate architectural designs; skills not installed are designated as **Not Available**.

| Skill ID | Status | Purpose & Contribution | Files & Sections Audited / Designed |
| :--- | :---: | :--- | :--- |
| `backend-architect` | **Active** | Architected decoupled admin operational boundary, RBAC permissions matrix, and state machine transition controls. | Sections 3, 4, and 6 |
| `database-architect` | **Active** | Audited PostgreSQL Prisma schema for high-throughput order querying, compound index design, and query performance. | `prisma/schema.prisma`, Section 7 |
| `prisma-expert` | **Active** | Evaluated Prisma query shapes (`include`, `select`, compound ordering, interactive transactions) for order updates and inventory checks. | Section 4 and 7 |
| `api-design-principles` | **Active** | Designed RESTful protected admin API contracts with pagination, multi-filtering, sorting, and standardized error responses. | Section 6 (API Contracts) |
| `api-security-best-practices` | **Active** | Designed strict anti-enumeration responses, server-side authorization guards, audit trail logging, and PII masking. | Sections 3, 4, and 7 |
| `threat-modeling-expert` | **Active** | Performed STRIDE security review on admin order overrides, manual payment tampering, and unauthorized data extraction. | Section 3 (RBAC & Threat Mitigations) |
| `ui-a11y` | **Active** | Designed high-contrast, screen-reader accessible admin table layout, clear focus rings, and keyboard shortcuts for print actions. | Section 5 and 6 |
| `web-design-guidelines` | **Active** | Formulated clean, clutter-free, high-density visual hierarchy for desktop/tablet order dispatching and black-and-white printing. | Section 5 (A4 Print Specifications) |
| `testing-patterns` | **Active** | Designed 9-dimension automated test matrix for Phase 5B covering access control, state transitions, and print layout invariance. | Section 8 (Test Plan Matrix) |
| `api-contract-testing` | **Active** | Established JSON payload schemas and status code contracts for `/api/admin/orders/*`. | Section 6 |
| `dependency-analysis` | **Active** | Audited UI and print dependencies (`lucide-react`, `@radix-ui`, `tailwindcss`) to ensure zero heavy external PDF libraries are needed. | `package.json`, Section 5 |
| `writing-guidelines` | **Active** | Authored comprehensive, technical, and actionable documentation following GitHub Flavored Markdown and project conventions. | Entire report |

---

## 2. Business & Operational Requirements

The Khati Khadyo admin operations cockpit is designed for high-efficiency daily fulfillment, warehouse packaging, and courier dispatch across Dhaka and nationwide Bangladesh.

### 2.1 Operational Visibility
Admin and manager personnel logging into `/admin/orders` will have real-time visibility into:
1. **Order Metadata:** Unique order number (e.g. `ORD-2026-A101`), precise date and time, current operational status.
2. **Customer Identity:** Customer name, verified phone number (`01XXXXXXXXX`), email address, complete delivery address.
3. **Special Instructions:** Customer order notes (e.g., "দয়া করে বিকেলে ডেলিভারি করবেন", "Ring doorbell").
4. **Items & Stock Health:** Product name (Bengali and English), thumbnail image, unit packaging (e.g., `500g`, `1kg`), unit price, ordered quantity, line total, and **real-time remaining stock indicator** with low-stock warning signal ($\le 5$ units).
5. **Financial Breakdown:** Subtotal, discount amount, coupon code applied (if any), delivery fee, grand total, payment method (`cod` vs `online`), and payment status (`pending`, `paid`, `failed`).
6. **Filtering & Search:** Real-time search by order number, customer phone, or customer name; multi-filter by date range, order status, and payment method; sorting by creation time and total amount.

---

## 3. Role-Based Access Control (RBAC) & Authorization Boundaries

To enforce least-privilege security and prevent unauthorized access or accidental data tampering, operational boundaries are segregated between **Super Admin (`admin`)**, **Store Manager (`manager`)**, and **Customer (`customer`)**.

```
                           [ Authenticated User ]
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
      [ Customer ]              [ Manager ]                [ Admin ]
           │                         │                         │
  • Own Orders Only         • View All Orders         • Full Control
  • Zero Admin Access       • Status Progression      • Status Progression
  • 404 on /admin/*         • Mark COD Paid           • Mark COD Paid
                            • Print A4 Labels         • Print A4 Labels
                            • Cancel with Reason      • Cancel & Auto-Refund
                            • No Price Editing        • Inventory Mutation
                            • No User Deletion        • Access Audit Logs
```

### 3.1 Permissions Matrix

| Operational Capability | Customer | Store Manager (`manager`) | Super Admin (`admin`) | Security Enforcement Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| **Access `/admin/*` Routes** | ❌ (HTTP 404) | ✅ | ✅ | Server-side `requireAdminOrManager()` in `layout.tsx` |
| **View Customer Order List & Details** | ❌ | ✅ | ✅ | Server session role check; customer gets 404 |
| **Print A4 Dual-Voucher / Courier Label** | ❌ | ✅ | ✅ | Protected route `/admin/orders/[orderNumber]/print` |
| **Progress Production Status (`confirmed` ➔ `shipped`)** | ❌ | ✅ | ✅ | Validated state machine transition in API |
| **Mark COD Order as Paid upon Delivery** | ❌ | ✅ | ✅ | Allowed **only** if `paymentMethod === 'cod'` |
| **Manual Override of Online Payment (`SSLCOMMERZ`)** | ❌ | ❌ **PROHIBITED** | ❌ **PROHIBITED** | **STRICT RULE:** Online payments strictly updated by IPN |
| **Cancel Order & Release Inventory/Coupon** | ❌ | ✅ (Audit reason mandatory) | ✅ | Atomic transaction with `AuditLog` creation |
| **Modify Product Pricing / Global Settings** | ❌ | ❌ | ✅ | Restricted to `admin` role only |
| **Inspect System Security & Access Audit Logs** | ❌ | ❌ | ✅ | Restricted to `admin` role only |

---

## 4. Order Status State Machine & Payment Conflict Prevention Plan

### 4.1 Production Flow State Machine
In accordance with [`src/lib/order-status.ts`](file:///Users/nasimp/Desktop/11111/1/src/lib/order-status.ts), the fulfillment lifecycle adheres to a linear forward-moving workflow with strict terminal boundaries:

$$\text{pending} \longrightarrow \text{confirmed} \longrightarrow \text{processing} \longrightarrow \text{packed} \longrightarrow \text{ready\_to\_ship} \longrightarrow \text{shipped} \longrightarrow \text{delivered}$$

**Terminal States:** `cancelled`, `returned`.

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │ (Order confirmed by manager)
                           ▼
                    ┌─────────────┐
                    │  CONFIRMED  │ ────┐
                    └──────┬──────┘     │
                           │            │
                           ▼            │ (Cancellation possible before dispatch)
                    ┌─────────────┐     │
                    │ PROCESSING  │ ────┤
                    └──────┬──────┘     │
                           │            │
                           ▼            │
                    ┌─────────────┐     │
                    │   PACKED    │ ────┤
                    └──────┬──────┘     │
                           │            │
                           ▼            │
                  ┌───────────────┐     │
                  │ READY_TO_SHIP │ ────┘
                  └──────┬────────┘     │
                         │              ▼
                         ▼      ┌───────────────┐
                    ┌─────────┐ │   CANCELLED   │ (Releases Stock & Coupon)
                    │ SHIPPED │ └───────────────┘
                    └────┬────┘
                         ├─────────────────────────┐
                         ▼                         ▼
                  ┌─────────────┐           ┌──────────────┐
                  │  DELIVERED  │           │   RETURNED   │
                  └─────────────┘           └──────────────┘
```

### 4.2 Payment Invariant & Conflict Prevention Rules
During the Phase 1B audit, the system established that **server-to-server IPN is the sole authoritative mutator for online payment states**. To prevent human error or tampering from breaking financial integrity:

1. **Online Payment Immutability:**
   - If `order.paymentMethod === 'online'`, the admin UI and `/api/admin/orders/[id]` **strictly disables** manual modification of `paymentStatus`.
   - Neither an admin nor a manager can change an online payment from `pending` to `paid` manually. Only verified SSLCOMMERZ IPN can execute this transition.
2. **Cash On Delivery (COD) Payment Policy:**
   - If `order.paymentMethod === 'cod'`, `paymentStatus` remains `pending` throughout packaging and shipping.
   - When the delivery agent collects cash and the order status transitions to `delivered`, the manager/admin can mark `paymentStatus = 'paid'`.
3. **Atomic Cancellation & Inventory Restitution:**
   - If an order is moved to `cancelled`, the backend **must invoke** `releaseOrderInventoryAndCoupon` inside the exact same interactive database transaction (`db.$transaction`).
   - Stock is restored, coupon usage count is decremented, and an `AuditLog` is committed atomically.

---

## 5. A4 Single-Page Dual-Voucher Print Architecture

The A4 print layout is architected to eliminate paper waste and streamline logistics by combining the **Internal Packing / Warehouse Slip** and the **External Delivery Partner / Courier Label** onto a single standard sheet of paper.

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ADMIN & PACKING SLIP (Top Half - 140mm)                  │
│                                                             │
│  [Logo] KHATI KHADYO            Order: #ORD-2026-A101       │
│  Authentic Bangladeshi Food     Date: 2026-11-04 14:30      │
│ ─────────────────────────────────────────────────────────── │
│  Customer: Customer Name        Phone: 01711-XXXXXX         │
│  Address: House 12, Road 4, Dhanmondi, Dhaka                │
│  Note: Please ring doorbell upon delivery                   │
│ ─────────────────────────────────────────────────────────── │
│  Item Description       Unit     Qty    Price    Line Total │
│  1. Sundarbans Honey    500g      2      ৳650      ৳1,300   │
│  2. Mustard Oil         1L        1      ৳360        ৳360   │
│ ─────────────────────────────────────────────────────────── │
│  Subtotal: ৳1,660 | Delivery: ৳60 | Discount: ৳0           │
│  GRAND TOTAL: ৳1,720  [ Payment Method: COD | PENDING ]     │
└─────────────────────────────────────────────────────────────┘
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
 ✂ কেটে আলাদা করুন (Cut Along Line for Courier Partner Label)
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
┌─────────────────────────────────────────────────────────────┐
│ 2. DELIVERY PARTNER / COURIER LABEL (Bottom Half - 130mm)   │
│                                                             │
│  RECIPIENT DETAILS:                                         │
│  Name: Customer Name                                        │
│  Phone: 01711-XXXXXX  (Alternative: 018XXXXXXXX)            │
│  Delivery Address: House 12, Road 4, Dhanmondi, Dhaka       │
│  District: Dhaka City                                       │
│ ─────────────────────────────────────────────────────────── │
│  Order Ref: #ORD-2026-A101      Package Count: 1 Parcel     │
│  Delivery Instruction: Handle with Care (Glass Honey Jars)  │
│ ─────────────────────────────────────────────────────────── │
│  CASH TO COLLECT (COD):               [ PAID IN ADVANCE ]   │
│  ৳ 1,720                              (DO NOT COLLECT CASH) │
│  [ █  ██  █  ███  █  ██ ]                                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Print CSS & Layout Specifications

```css
@media print {
  /* Enforce exact A4 portrait dimensions with zero browser header/footer margins */
  @page {
    size: A4 portrait;
    margin: 8mm 10mm;
  }

  /* Reset layout for crisp thermal / laser printing */
  html, body {
    width: 210mm;
    height: 297mm;
    margin: 0 !important;
    padding: 0 !important;
    background: #ffffff !important;
    color: #000000 !important;
    font-family: 'SolaimanLipi', 'Kalpurush', system-ui, -apple-system, sans-serif !important;
    font-size: 11px !important;
    line-height: 1.35 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Hide navigation, buttons, toast banners, and sidebars */
  header, nav, footer, button, .no-print {
    display: none !important;
  }

  /* Single page constraint - strictly prevent multi-page spillover */
  .a4-container {
    width: 100%;
    max-height: 280mm;
    page-break-inside: avoid;
    page-break-after: avoid;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  /* Top Half: Packing Copy */
  .packing-slip {
    height: 135mm;
    overflow: hidden;
  }

  /* Cut line divider */
  .cut-line {
    height: 10mm;
    border-top: 1.5px dashed #4b5563 !important;
    text-align: center;
    position: relative;
    margin: 4mm 0;
  }

  /* Bottom Half: Delivery Label */
  .delivery-label {
    height: 125mm;
    border: 2px solid #000000 !important;
    border-radius: 6px;
    padding: 8mm;
    overflow: hidden;
  }

  /* Table styling */
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    border: 1px solid #d1d5db;
    padding: 4px 6px;
  }
  th {
    background-color: #f3f4f6 !important;
    font-weight: bold;
  }
}
```

### 5.2 Print Acceptance Criteria
1. **Single Sheet Guarantee:** The document must fit on exactly **one sheet of A4 paper** (zero blank second page).
2. **Bengali Typography:** Bengali characters in names, notes, and addresses render cleanly without font clipping or broken ligatures.
3. **High-Contrast B&W:** Pure white background (`#ffffff`), dark black text (`#000000`), no colored backgrounds that consume printer ink or appear muddy.
4. **Zero Secret Leakage:** Payment gateway session keys, raw transaction payloads, or card details are **strictly excluded** from the print DOM.

---

## 6. Admin Dashboard Architecture & Route Tree

The admin operations console will be migrated to native Next.js 16 App Router under the `/admin` path:

```
src/app/
├── admin/
│   ├── layout.tsx                   # Server-side RBAC guard (admin/manager session check)
│   ├── page.tsx                     # Redirects to /admin/orders
│   ├── orders/
│   │   ├── page.tsx                 # High-density order list table with search & multi-filter
│   │   ├── [orderNumber]/
│   │   │   ├── page.tsx             # Single order operations view with live stock alerts
│   │   │   └── print/
│   │   │       └── page.tsx         # Dedicated A4 dual-voucher print view
│   └── (future sub-modules: products, categories, reviews, banners, settings)
```

### 6.1 Proposed API Contracts

#### 1. `GET /api/admin/orders`
- **Authentication:** Admin or Manager session required.
- **Query Parameters:**
  - `page`: Integer (default `1`)
  - `limit`: Integer (default `20`, max `100`)
  - `search`: String (searches `orderNumber`, `user.name`, `user.phone`, `guestPhone`, `guestName`)
  - `status`: String (`pending`, `confirmed`, `processing`, `packed`, `ready_to_ship`, `shipped`, `delivered`, `cancelled`)
  - `paymentStatus`: String (`pending`, `paid`, `failed`)
  - `paymentMethod`: String (`cod`, `online`)
  - `startDate`, `endDate`: ISO Date strings
  - `sortBy`: `createdAt_desc` | `createdAt_asc` | `total_desc` | `total_asc`
- **Response Payload:**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "cuid_1",
          "orderNumber": "ORD-2026-A101",
          "createdAt": "2026-11-04T10:00:00Z",
          "customer": {
            "name": "Customer Name",
            "phone": "01711000001",
            "isVerified": true
          },
          "itemsSummary": "Sundarbans Honey (500g) × 2, Mustard Oil (1L) × 1",
          "itemCount": 3,
          "totalAmount": 1720,
          "paymentMethod": "cod",
          "paymentStatus": "pending",
          "orderStatus": "confirmed",
          "hasLowStockItem": false
        }
      ],
      "pagination": { "page": 1, "limit": 20, "total": 142, "totalPages": 8 },
      "metrics": { "pendingCount": 12, "processingCount": 24, "shippedToday": 38 }
    }
  }
  ```

#### 2. `PATCH /api/admin/orders/[orderNumber]/status`
- **Authentication:** Admin or Manager session.
- **Request Body:**
  ```json
  {
    "orderStatus": "processing",
    "note": "Items gathered from warehouse shelf B-4",
    "codPaymentReceived": false // true ONLY when orderStatus === 'delivered' and paymentMethod === 'cod'
  }
  ```
- **Validation Guard:** Checks `ALLOWED_ORDER_TRANSITIONS` against current status. Rejects illegal jumps.
- **Side Effects:** Appends entry to `OrderStatusHistory`, logs admin action to `AuditLog`.

---

## 7. Database Performance, Indexing & PII Minimization

### 7.1 Database Indexing Strategy
To ensure sub-50ms query times on order lists with thousands of records, the following indexing topology was audited:

1. **Existing Indexes in [`prisma/schema.prisma`](file:///Users/nasimp/Desktop/11111/1/prisma/schema.prisma#L270-L280):**
   - `@@index([orderNumber])`
   - `@@index([userId])`
   - `@@index([orderStatus])`
   - `@@index([paymentStatus])`
   - `@@index([createdAt])`
2. **Recommended Composite Indexes (Planned for Phase 5B Migration):**
   ```prisma
   // For filtered status listings sorted by date:
   @@index([orderStatus, createdAt(sort: Desc)])
   @@index([paymentStatus, createdAt(sort: Desc)])
   ```
3. **Search Performance:**
   - For fast lookups by phone or order number without full table scans, Prisma queries will use strict indexed lookups on `orderNumber` and normalized customer phone numbers.

### 7.2 Customer PII Minimization & Audit Policy
- **Access Logging:** Any bulk export of customer orders (e.g. CSV/Excel export) or full PII unmasking writes an entry to `AuditLog` (`action: 'ORDER_LIST_EXPORTED'`).
- **Secret Separation:** Sensitive gateway fields (`sessionKey`, `verify_sign`, `store_passwd`, raw payment payloads) are **never selected** in admin queries.
- **Order-Number Anti-Enumeration:** External/customer requests to non-existent or unauthorized orders return uniform HTTP 404 (maintained from Phase 2C.1).

---

## 8. Implementation Test Matrix for Phase 5B

The following 9 operational verification dimensions must be covered by automated tests before Phase 5 is considered complete:

| # | Dimension | Test Scenario | Expected Outcome |
| :---: | :--- | :--- | :--- |
| **1** | **Customer Access Blocking** | Customer session attempts `GET /admin/orders` or `/api/admin/orders`. | Rejected with HTTP 404 / 401 redirect; zero admin data leaked. |
| **2** | **Manager Authorized Access** | Manager session requests order list and single order detail. | Returns 200 OK with complete items, customer contact, and status. |
| **3** | **Search, Filter & Pagination** | Search by phone, filter by `status=pending`, and paginate with `limit=10`. | Returns exact matching subset with accurate total count and pagination metadata. |
| **4** | **Safe Status Transitions** | Transition order from `confirmed` ➔ `processing` ➔ `packed`. | Status transitions successfully; history entry and audit log recorded. |
| **5** | **Illegal Transition Rejection** | Attempt jumping status from `pending` directly to `delivered`. | Rejected with HTTP 400 `Cannot change order from pending to delivered`. |
| **6** | **Online Payment Immutability** | Admin attempts manual `paymentStatus: 'paid'` on an online order. | Rejected with HTTP 400; online payments only mutatable via server IPN. |
| **7** | **COD Payment on Delivery** | Manager marks COD order as `delivered` and `paid`. | Both status fields update cleanly within atomic transaction. |
| **8** | **A4 Print Layout Invariance** | Render `/admin/orders/[orderNumber]/print`. | Top half contains packing copy, middle contains cut line, bottom contains courier label. Zero payment secrets. |
| **9** | **Audit Logging on Mutation** | Manager cancels an order or updates status. | `AuditLog` entry created with admin ID, previous state, new state, and client IP. |

---

## 9. Prerequisites & Blocking Conditions Checklist

Before proceeding to Phase 5B implementation, the following architectural and infrastructure requirements must be verified:

### 9.1 Infrastructure & Environment Readiness
- [ ] **Vercel Preview Environment Variables:**
   - `DATABASE_URL`, `DIRECT_URL`, and `JWT_SECRET` ($\ge 32$ chars) must be enabled in the Vercel Dashboard with the **Preview** checkbox checked. (Resolves preview 500 runtime crashes).
- [ ] **Admin Account Provisioning:**
   - Execute the non-destructive safe admin recovery script (`scripts/safe-upsert-admin.ts`) once database connection is verified to ensure standard admin access credentials exist.

### 9.2 Schema & Database Migration Assessment
- **Schema Migration Required?** **NO.**
  - The existing Prisma schema (`Order`, `OrderItem`, `Payment`, `User`, `Address`, `OrderStatusHistory`, `AuditLog`) already contains all fields necessary to support the admin operations dashboard and A4 print view.
  - Optional composite indexes (`@@index([orderStatus, createdAt(sort: Desc)])`) can be added non-destructively for performance optimization.

### 9.3 Existing APIs Safely Reusable in Phase 5B
- `src/lib/order-authorization.ts` ➔ Reused for server-side order data serialization.
- `src/lib/order-status.ts` ➔ Reused as the single source of truth for production status flow.
- `src/lib/order-inventory.ts` ➔ Reused for atomic inventory release on order cancellation.
- `src/lib/security.ts` ➔ Reused for admin role authorization guards and rate limiting.

### 9.4 Acceptance Criteria for Phase 5B Implementation
1. `/admin/orders` renders a clean, high-density order list with real-time filters and search.
2. Clicking an order opens `/admin/orders/[orderNumber]` with complete details and status advancement controls.
3. `/admin/orders/[orderNumber]/print` renders the dual-voucher A4 template ready for direct single-page browser printing.
4. Customer accounts cannot access any `/admin/*` route or admin API.
5. Online payment states remain strictly protected from manual tampering.
6. TypeScript, ESLint, full test suite (including new admin tests), and production build pass with 0 errors.
