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


---

## 10. Admin Product Advertising Link & UTM Campaign URL Generator

### 10.1 Feature Overview

**Purpose:** Allow admin and manager roles to generate trackable advertising URLs for any active product, enabling attribution measurement across paid social and search ad campaigns.

**Scope:**
- Admin-only panel — visible in the product row in the admin product list and on the `/admin/products/[slug]` detail page (planned for Phase 5B)
- Zero customer-facing exposure — no UTM configuration data, no ad-link UI, and no campaign metadata are ever rendered on customer-facing pages

**Key capabilities:**
1. Display the canonical production URL for a product (copy-to-clipboard with one click)
2. Build a UTM-decorated campaign URL with configurable `utm_source`, `utm_medium`, `utm_campaign`, and optional `utm_content`
3. Enforce production-domain-only base URL — never `localhost` or Vercel preview domains
4. Disable link generation for inactive or archived products with a clear warning banner

---

### 10.2 Database Schema Decision

#### MVP (Phase 5B): No new DB table required

UTM parameters are **stateless query parameters** generated entirely in the admin UI at copy time. The base URL is derived server-side from `NEXT_PUBLIC_APP_URL` and returned to the client via a protected API endpoint. No persistent storage is needed for MVP.

#### Phase 6+ optional: `CampaignLink` table

```prisma
model CampaignLink {
  id          String   @id @default(cuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  slug        String   // denormalized for query performance
  source      String   // facebook, instagram, google, tiktok, other
  medium      String   // paid_social, cpc
  campaign    String
  content     String?  // optional ad-set label
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])
  createdAt   DateTime @default(now())

  @@index([productId])
  @@index([createdAt])
}
```

**What this enables in Phase 6+:**
- Audit trail — who generated which link and when
- Link performance correlation if UTM data is imported from Google Analytics or Meta Ads Manager
- Campaign frequency analysis per product and per manager

---

### 10.3 Security Rules

1. **Production domain enforcement** — The URL base is derived exclusively from `NEXT_PUBLIC_APP_URL` server-side. Fallback to `khatikhadyo.com` only if the env variable is correctly set and starts with `https://`. Never `VERCEL_URL`. Never `localhost`.
2. **Destination whitelist** — Only `/products/[slug]` is a valid ad-link destination. Cart, checkout, admin, API, and order paths are blocked by a server-side path prefix check before the URL is returned.
3. **Inactive product block** — If `product.status !== 'active'`, the API returns `{ active: false }` and the UI shows a warning banner with the Copy button disabled (`aria-disabled=true`).
4. **Admin-only** — The entire ad-link panel lives inside `/admin/*` routes, protected by `requireAdmin()` in the layout. No UTM data ever reaches a customer session or customer-facing page.
5. **UTM encoding** — All UTM parameter values are URL-encoded via the browser-native `URLSearchParams` API, preventing injection of arbitrary query string characters.
6. **Audit log** — Each link generation/copy action is optionally logged to `AuditLog` with `action: 'AD_LINK_GENERATED'`, `entityType: 'Product'`, `entityId: productId` (see Section 10.8).

---

### 10.4 Server-Side API Contract

**Endpoint:** `GET /api/admin/products/[slug]/ad-url`

| Property | Value |
|---|---|
| Authentication | Admin or Manager session required — HTTP 401 otherwise |
| Rate limit | Inherits global admin API rate limit from `src/lib/security.ts` |
| Caching | `no-store` — always reads live product status from DB |

**Server logic (ordered steps):**
1. Verify session via `requireAdmin()` — return HTTP 401/403 if unauthorized
2. Fetch product by `slug` from DB
3. If `product.status !== 'active'`, return HTTP 200 with `{ success: true, data: { active: false, warning: 'Product is inactive. Ad link disabled.' } }`
4. Read `NEXT_PUBLIC_APP_URL` server-side; verify it starts with `https://` — return HTTP 500 if not
5. Build canonical URL: `${baseUrl}/products/${product.slug}`
6. Verify canonical URL path starts with `/products/` — reject any other prefix
7. Return product metadata and canonical URL

**Success response:**
```json
{
  "success": true,
  "data": {
    "productId": "...",
    "slug": "sundarbans-honey-500g",
    "name": "সুন্দরবনের খাঁটি মধু ৫০০গ্রাম",
    "status": "active",
    "canonicalUrl": "https://khatikhadyo.com/products/sundarbans-honey-500g",
    "ogImage": "https://res.cloudinary.com/...",
    "price": 650,
    "currency": "BDT"
  }
}
```

**Inactive product response (HTTP 200):**
```json
{
  "success": true,
  "data": {
    "active": false,
    "warning": "Product is inactive. Ad link disabled."
  }
}
```

---

### 10.5 UTM URL Builder Logic (Client-Side Admin Component)

```typescript
// src/components/admin/AdLinkGenerator.tsx (Phase 5B implementation target)

const UTM_SOURCES = ['facebook', 'instagram', 'google', 'tiktok', 'other'] as const
const UTM_MEDIUMS = ['paid_social', 'cpc'] as const

function buildUtmUrl(
  canonicalUrl: string,
  utm: { source: string; medium: string; campaign: string; content?: string }
): string {
  const url = new URL(canonicalUrl)
  // Safety: verify host matches expected production domain
  const allowedHost = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
    : 'khatikhadyo.com'
  if (url.host !== allowedHost) throw new Error('Invalid ad link host')

  url.searchParams.set('utm_source', utm.source)
  url.searchParams.set('utm_medium', utm.medium)
  url.searchParams.set('utm_campaign', utm.campaign.trim())
  if (utm.content?.trim()) url.searchParams.set('utm_content', utm.content.trim())
  return url.toString()
}
```

**Component responsibilities:**
- Fetches canonical URL from `/api/admin/products/[slug]/ad-url` on mount (SWR or React Query with `no-store`)
- Renders active/inactive state from API response
- Calls `buildUtmUrl()` on every UTM field change (derived state, no server round-trip)
- Clipboard write via `navigator.clipboard.writeText()` with a success toast on copy
- Opens landing page in new tab via `window.open(canonicalUrl, '_blank', 'noopener,noreferrer')`

---

### 10.6 UI Component Design

**Active product — full panel:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📢 Ad Link Generator            [Active Product ✓]          │
│ ─────────────────────────────────────────────────────────── │
│ Canonical URL:                                              │
│  https://khatikhadyo.com/products/sundarbans-honey-500g    │
│  [Copy Ad Link 📋]  [Open Landing Page ↗]                  │
│ ─────────────────────────────────────────────────────────── │
│ UTM Campaign URL Builder (optional):                        │
│  Source:  [facebook ▾]  Medium: [paid_social ▾]           │
│  Campaign: [eid-sale-2026          ]                        │
│  Ad Set:   [honey-banner-v2        ] (optional)             │
│                                                             │
│  Generated URL:                                             │
│  https://khatikhadyo.com/products/sundarbans-honey-        │
│  500g?utm_source=facebook&utm_medium=paid_social&utm_       │
│  campaign=eid-sale-2026&utm_content=honey-banner-v2        │
│  [Copy UTM Link 📋]                      ✓ Copied!         │
└─────────────────────────────────────────────────────────────┘
```

**Inactive product — warning state:**
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Ad Link Generator                                        │
│  This product is currently INACTIVE.                       │
│  Ad link generation is disabled until the product is       │
│  set to Active status.                                      │
│  [Copy Ad Link 📋] ← DISABLED (grey, aria-disabled=true)  │
└─────────────────────────────────────────────────────────────┘
```

**Accessibility requirements:**
- Disabled Copy button uses `aria-disabled="true"` and `tabIndex={-1}` (not `disabled` attribute, to allow focus-visible outline for keyboard users)
- Toast announcements use `role="status"` and `aria-live="polite"`
- Dropdown selects are native `<select>` elements for maximum screen-reader compatibility

---

### 10.7 Meta/Google Ad Compatibility Audit

| Requirement | Status | Notes |
|---|---|---|
| OG `og:title` per product | ✅ Implemented | `generateMetadata` exports per-slug |
| OG `og:description` | ✅ Implemented | From product `shortDescription` |
| OG `og:image` | ✅ Implemented | Cloudinary URL from product images |
| OG `og:url` canonical | ✅ Implemented | `${baseUrl}/products/${slug}` |
| OG `og:type` | ✅ `website` | Meta does not require `og:type=product` for ad landing pages |
| Twitter card | ✅ `summary_large_image` | |
| JSON-LD Product schema | ✅ Implemented | Schema.org Product, Offer, AggregateRating |
| Canonical URL | ✅ Implemented | `alternates.canonical` |
| **Meta "Buy Now" button** | N/A — Ads Manager only | Configured in Meta Ads Manager, NOT in website code |
| **Google Shopping** | ✅ Ready | JSON-LD has price, currency (BDT), availability, image |
| Facebook Pixel | ❌ Not implemented | Recommended for Phase 6B |
| Google Analytics 4 | ❌ Not implemented | Required to track UTM campaigns |

> **Important:** Meta "Buy Now" / "Shop Now" CTA buttons are configured exclusively in Meta Ads Manager when creating the ad campaign. The website code does not implement any special button for this — the ad platform reads the product landing page's Open Graph tags to auto-populate ad creative previews. The website's responsibility is to ensure OG tags are correct (already done).

---

### 10.8 Audit Log Policy

```typescript
// Optional: log to AuditLog when admin generates/copies an ad link
await db.auditLog.create({
  data: {
    userId: adminUserId,
    action: 'AD_LINK_GENERATED',
    entityType: 'Product',
    entityId: productId,
    details: JSON.stringify({
      slug: product.slug,
      utm_source: utm?.source,
      utm_campaign: utm?.campaign,
    }),
    ipAddress: clientIp,
  }
})
```

**Policy:** Audit logging for ad link generation is **optional for MVP**. It is recommended to enable from Phase 5B launch onward for campaign attribution auditing and to satisfy any future compliance requirements. The `AuditLog` model in `prisma/schema.prisma` already supports this without schema migration.

---

### 10.9 Phase 5B Acceptance Criteria (Addition to Section 9.4)

The following items extend the acceptance criteria list in Section 9.4:

7. Admin/manager can view the canonical product URL for any active product in the product detail view
8. One-click Copy Ad Link copies the clean production URL to clipboard and displays a success toast
9. Open Landing Page opens the product page in a new tab (`noopener,noreferrer`)
10. UTM URL builder generates a correctly encoded URL with all parameters on every field change
11. Inactive/archived product shows a warning banner; Copy button is visually disabled with `aria-disabled=true`
12. Customer-facing product pages contain no ad-link UI or UTM configuration data
13. Ad link URLs only use the `https://khatikhadyo.com` base — never `localhost` or a Vercel preview domain
14. *(Optional)* AuditLog entry is created when an admin generates or copies a campaign link

---

### 10.10 Test Matrix

| # | Test | Input | Expected |
|---|---|---|---|
| 1 | Active product canonical URL | slug: `sundarbans-honey-500g` | Returns `https://khatikhadyo.com/products/sundarbans-honey-500g` |
| 2 | UTM URL encoding — special chars | campaign: `eid sale & promo` | Encoded: `eid+sale+%26+promo` |
| 3 | UTM URL encoding — XSS attempt | source: `<script>alert(1)</script>` | `URLSearchParams` encoding neutralizes — no script tag in output |
| 4 | Preview/localhost host rejected | `NEXT_PUBLIC_APP_URL=localhost` | Server throws, returns HTTP 500 (non-`https://` rejected by validation) |
| 5 | Inactive product API response | `product.status = 'inactive'` | `{ active: false, warning: '...' }` |
| 6 | Inactive product UI | Admin views inactive product | Copy button disabled, warning banner visible |
| 7 | Customer access blocked | Customer session → `GET /api/admin/products/[slug]/ad-url` | HTTP 401/403 |
| 8 | Unauthenticated access blocked | No session → `GET /api/admin/products/[slug]/ad-url` | HTTP 401 |
| 9 | Destination path validation | Attempt to generate URL for `/checkout` | Rejected — only `/products/[slug]` path prefix allowed |
| 10 | Copy UTM link → product page loads | Paste UTM URL in browser | Product page loads; `utm_source` parameter preserved in address bar |

---
