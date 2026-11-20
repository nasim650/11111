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

## Next-phase isolated-resource verification (2026-11-20)

| Service | Resource identity / scope | Tests executed | Result | Remaining blocker |
|---|---|---|---|---|
| Neon PostgreSQL | Separate project `Khati_Khadyo_TEST`, project ID `square-bird-76303064`, Singapore; one empty `production` branch | Console identity check; empty-branch/storage check | PASS (isolation) | BLOCKED: compute was suspended and no migration, transaction, checkout, inventory, or order write was run |
| Upstash Redis | Separate database `khati-khadyo-test`, N. Virginia (`us-east-1`); Preview scope configured separately from Production/Development | Safe `SET`, `GET`, `EXPIRE`, `TTL`, and `DEL` on a unique test key | PASS (resource control-plane test) | BLOCKED: Preview secret value was not disclosed or independently matched to this resource; application connection and outage fallback remain untested |
| Vercel Preview environment | Existing shared Redis value retained for Production/Development; separate Preview-branch secret entry present | Scope inspection only | PASS (scope separation) / BLOCKED (target verification) | A new Preview deployment is required after the target is confirmed |

## Findings

- The application has server-only credential access patterns for Cloudinary, SMS, Redis, and SSLCOMMERZ.
- Local filesystem upload fallback is not persistent storage on typical serverless deployments and must not be relied on for final Vercel production.
- The upload route allows 50 MB, while one error message says 5 MB; this is a documentation/message inconsistency and should be corrected before launch.
- External credentials and final domains must be configured again in the dedicated future Production environment.
- No live write, payment, SMS, upload, deletion, or credential mutation was performed during this audit.
- Vercel settings also show `JWT_SECRET` scoped to All Environments. Values were not revealed or copied; separate Preview/Production secret management is required before launch.
- The dedicated Neon and Upstash resources were provisioned without touching the existing resources. Neon migration and application-level Redis tests remain blocked until the connection targets can be safely confirmed and the Neon compute is available.
