# Order Lifecycle Test Matrix

| Feature | Expected Behavior | Actual Result | Status |
|---|---|---|---|
| Customer Checkout | Valid checkout creates one order | Covered by existing order hardening tests; full run did not complete | BLOCKED |
| COD | Payment remains pending at creation | Enforced by checkout implementation and existing tests | PASS |
| Order Items | Items are created within the order transaction | Implemented and covered by checkout tests | PASS |
| Inventory | Stock decrements atomically and never below zero | Implemented with conditional updates | PASS |
| Coupon Preview | Preview does not consume quota | Fixed; static validation passed | PASS |
| Coupon Checkout | Usage claim is conditional and transactional | Fixed; dedicated concurrent live DB run not completed | BLOCKED |
| Loyalty Redemption | Balance cannot be overdrawn concurrently | Fixed with conditional decrement; live DB run not completed | BLOCKED |
| Admin Confirmation | Pending can transition to confirmed | API transition is aligned with UI | PASS |
| Admin Processing | Confirmed can transition to processing | API transition is aligned with UI | PASS |
| Admin Packing | Processing can transition to packed | API transition is aligned with UI | PASS |
| Admin Ready to Ship | Packed can transition to ready_to_ship | API transition is aligned with UI | PASS |
| Admin Shipping | Ready to ship can transition to shipped | API transition is aligned with UI | PASS |
| Admin Delivery | Shipped can transition to delivered | API transition is aligned with UI | PASS |
| Invalid Transition | Unsupported transitions are rejected | Server-side transition validation exists | PASS |
| Cancellation | Status, history, stock, coupon, and label remain consistent | Moved into one transaction | PASS |
| Customer Ownership | Customer cannot access another customer's order | Existing authorization tests pass | PASS |
| Customer Status | Customer sees current database status | Existing order fetch is server-authorized; live sync not run | BLOCKED |
| Order Timeline | Timeline includes configured statuses and DB timestamps | Implemented from status history | PASS |
| Customer Receipt | Customer can print/save order information | Existing browser print flow found | PASS |
| Admin Receipt | Admin can print delivery label/order information | Existing admin print flow found | PASS |
| Payment Collection | COD payment can be updated separately from order status | API supports separate payment status updates | BLOCKED |
| PostgreSQL Connectivity | Production database connection succeeds | Not tested against supplied live credentials | BLOCKED |
| Production Build | Production build succeeds | Not run in this audit pass | NOT RUN |
