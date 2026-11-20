# External Services Audit

| Service | Implementation | Verification | Status |
|---|---|---|---|
| PostgreSQL/Neon | Prisma datasource with pooled URL and direct URL | No isolated TEST URLs configured | BLOCKED |
| Redis | `ioredis` shared rate limiter with local fallback | No live connectivity test performed | BLOCKED |
| Cloudinary | Signed server-side upload/delete adapter with local fallback | Static code inspection only; no upload/delete performed | BLOCKED |
| SMS | Cloud SMS BD and BulkSMSBD adapters with test mocks | Test mocks pass; no real SMS sent | PASS (mock only) |
| SSLCOMMERZ | Sandbox/live URL selection, callback parsing, signature verification, IPN flow | Existing callback/payment tests pass; no external payment initiated | PASS (local) / BLOCKED (live) |
| File uploads | Admin-only, CSRF/rate-limit protected, MIME/extension/size checks | Static inspection only | PASS (static) |
| Vercel | Deployment documentation exists | Dashboard and deployment logs not accessed | BLOCKED |

## Findings

- The application has server-only credential access patterns for Cloudinary, SMS, Redis, and SSLCOMMERZ.
- Local filesystem upload fallback is not persistent storage on typical serverless deployments and must not be relied on for final Vercel production.
- The upload route allows 50 MB, while one error message says 5 MB; this is a documentation/message inconsistency and should be corrected before launch.
- External credentials and final domains must be configured again in the dedicated future Production environment.
