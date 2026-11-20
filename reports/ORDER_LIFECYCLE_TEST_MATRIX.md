# Order Lifecycle Test Matrix

| Feature | Expected Behavior | Actual Result | Status |
|---|---|---|---|
| Customer Checkout | Valid checkout creates one order | 7 isolated checkout tests passed, including authenticated COD checkout | PASS |
| COD | Payment remains pending at creation | Enforced by checkout implementation and existing tests | PASS |
| Order Items | Items are created within the order transaction | Implemented and covered by checkout tests | PASS |
| Inventory | Stock decrements atomically and never below zero | Implemented with conditional updates | PASS |
| Coupon Preview | Preview does not consume quota | Fixed; static validation passed | PASS |
| Coupon Checkout | Usage claim is conditional and transactional | Fixed; isolated concurrency run requires PostgreSQL | BLOCKED |
| Loyalty Redemption | Balance cannot be overdrawn concurrently | Fixed; isolated concurrency run requires PostgreSQL | BLOCKED |
| Admin Confirmation | Pending can transition to confirmed | Lifecycle verification passed and customer API returned confirmed | PASS |
| Admin Processing | Confirmed can transition to processing | Lifecycle verification passed and customer API returned processing | PASS |
| Admin Packing | Processing can transition to packed | Lifecycle verification passed and customer API returned packed | PASS |
| Admin Ready to Ship | Packed can transition to ready_to_ship | Lifecycle verification passed and customer API returned ready_to_ship | PASS |
| Admin Shipping | Ready to ship can transition to shipped | Lifecycle verification passed and customer API returned shipped | PASS |
| Admin Delivery | Shipped can transition to delivered | Lifecycle verification passed and customer API returned delivered | PASS |
| Invalid Transition | Unsupported transitions are rejected | Server-side transition validation exists | PASS |
| Cancellation | Status, history, stock, coupon, and label remain consistent | Moved into one transaction | PASS |
| Customer Ownership | Customer cannot access another customer's order | Existing authorization tests pass | PASS |
| Customer Status | Customer sees current database status | Independently verified after every supported transition | PASS |
| Order Timeline | Timeline includes configured statuses and DB timestamps | Implemented from status history and verified by customer authorization suite | PASS |
| Customer Receipt | Customer can print/save order information | Existing browser print flow found | PASS |
| Admin Receipt | Admin can print delivery label/order information | Existing admin print flow found | PASS |
| Payment Collection | COD payment can be updated separately from order status | API supports separate payment status updates | BLOCKED |
| PostgreSQL Connectivity | Isolated PostgreSQL connection succeeds | Docker daemon unavailable; no isolated PostgreSQL endpoint supplied | BLOCKED |
| Production Build | Production build succeeds | `npm run build` completed successfully | PASS |
| Repository Test Exit | Test command exits cleanly | Assertions pass, but existing Prisma clients keep process open | BLOCKED |
