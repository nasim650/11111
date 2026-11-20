# External Services Audit

| Service | Implementation | Verification | Status |
|---|---|---|---|
| PostgreSQL/Neon | Prisma datasource with pooled URL and direct URL | Vercel settings show `DATABASE_URL` and `DIRECT_URL` scoped to All Environments; no isolated TEST target proven | FAIL / BLOCKED |
| Redis | `ioredis` shared rate limiter with local fallback | Vercel settings show `REDIS_URL` scoped to All Environments; no live connectivity test performed | BLOCKED |
| Cloudinary | Signed server-side upload/delete adapter with local fallback | Static code inspection only; no upload/delete performed | BLOCKED |
| SMS | Cloud SMS BD and BulkSMSBD adapters with test mocks | Test mocks pass; no real SMS sent | PASS (mock only) |
| SSLCOMMERZ | Sandbox/live URL selection, callback parsing, signature verification, IPN flow | Existing callback/payment tests pass; no external payment initiated | PASS (local) / BLOCKED (live) |
| File uploads | Admin-only, CSRF/rate-limit protected, MIME/extension/size checks | Static inspection only | PASS (static) |
| Vercel | Preview deployment exists and was inspected | Preview status and read-only browser checks completed; environment identity is not exposed publicly | PASS (Preview) / BLOCKED (environment verification) |

## Findings

- The application has server-only credential access patterns for Cloudinary, SMS, Redis, and SSLCOMMERZ.
- Local filesystem upload fallback is not persistent storage on typical serverless deployments and must not be relied on for final Vercel production.
- The upload route allows 50 MB, while one error message says 5 MB; this is a documentation/message inconsistency and should be corrected before launch.
- External credentials and final domains must be configured again in the dedicated future Production environment.
- No live write, payment, SMS, upload, deletion, or credential mutation was performed during this audit.
- Vercel settings also show `JWT_SECRET` scoped to All Environments. Values were not revealed or copied; separate Preview/Production secret management is required before launch.
