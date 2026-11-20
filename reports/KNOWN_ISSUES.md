# Known Issues

| Issue | Status | Impact | Evidence / next action |
|---|---|---|---|
| Authenticated admin workflow not fully exercised | BLOCKED | Protected `/admin` and `/admin/dashboard` now route correctly, but no approved admin credentials were submitted for dashboard CRUD verification. | Use a safe test admin account after confirming Preview database isolation. |
| Full test runner does not exit naturally | BLOCKED | CI/readiness cannot prove clean resource teardown. | Full forced-exit run is 167 passed, 0 failed; isolated checkout suite passes 13 tests but leaves an outbound socket after Prisma disconnect. Investigate test-loader/client lifecycle. |
| Preview database isolation is unknown | BLOCKED | A dedicated Neon test project now exists, but Preview `DATABASE_URL`/`DIRECT_URL` are not configured or identity-verified; writes remain unauthorized. | Configure and verify the dedicated Neon target, then run migrations and isolated writes only there. |
| Vercel shared environment scope | FAIL / BLOCKED | Database variables and `JWT_SECRET` remain `All Environments`; `REDIS_URL` now has the original Production/Development entry plus a separate Preview-branch entry, but its target is not independently verified. | Confirm dedicated Preview database and Redis values without exposing secrets; do not alter Production resources. |
| Live Redis application connectivity is unverified | BLOCKED | The dedicated Upstash database passed safe control-plane `SET`/`GET`/`TTL`/`DEL` checks, but the deployed application has not been redeployed against and tested with the isolated value. | Redeploy Preview after target verification and test cache, expiry, rate limiting, and fallback. |
| SMS/OTP delivery is unverified | BLOCKED | Real registration/recovery delivery is not proven. | Use provider sandbox or an explicitly approved test destination. |
| SSLCommerz sandbox connectivity is unverified | BLOCKED | End-to-end payment settlement is not proven. | Use sandbox credentials and an approved test order only. |
| Preview feedback overlay is rejected by CSP | BLOCKED | Vercel overlay produces console noise in Preview. | Keep application CSP unchanged unless overlay support is an explicit requirement; no application 5xx was observed. |

No issue above authorizes production deployment or destructive remediation.
