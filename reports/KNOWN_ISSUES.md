# Known Issues

| Issue | Status | Impact | Evidence / next action |
|---|---|---|---|
| Preview admin URLs return 404 | FAIL on deployed Preview | Admin cannot be reached through canonical URLs on commit `4bea600`. | Local protected catch-all route is implemented and included in the build; commit and Preview verification require explicit approval. |
| Full test runner does not exit naturally | BLOCKED | CI/readiness cannot prove clean resource teardown. | Full forced-exit run is 167 passed, 0 failed; isolated checkout suite passes 13 tests but leaves an outbound socket after Prisma disconnect. Investigate test-loader/client lifecycle. |
| Preview database isolation is unknown | BLOCKED | Writes cannot be safely authorized against the current Preview. | Obtain Vercel environment metadata and a dedicated isolated test database before write tests. |
| Vercel shared environment scope | FAIL / BLOCKED | `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, and `JWT_SECRET` are configured for `All Environments`, so Preview/Production separation is not proven. | Create dedicated Preview variables without modifying Production until an approved migration plan is ready. |
| Live Redis connectivity is unverified | BLOCKED | Distributed rate-limit/cache behavior is not proven. | Use a dedicated test Redis and a read-only/approved smoke test. |
| SMS/OTP delivery is unverified | BLOCKED | Real registration/recovery delivery is not proven. | Use provider sandbox or an explicitly approved test destination. |
| SSLCommerz sandbox connectivity is unverified | BLOCKED | End-to-end payment settlement is not proven. | Use sandbox credentials and an approved test order only. |
| Preview feedback overlay is rejected by CSP | BLOCKED | Vercel overlay produces console noise in Preview. | Keep application CSP unchanged unless overlay support is an explicit requirement; no application 5xx was observed. |

No issue above authorizes production deployment or destructive remediation.
