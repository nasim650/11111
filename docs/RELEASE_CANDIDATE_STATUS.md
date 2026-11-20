# Khati Khadyo Release Candidate Status

**Date:** 2026-11-13  
**Release candidate branch:** `phase-1b-implementation`  
**Target branch:** `main`  
**Status:** Ready for pull-request review; merge is blocked until the owner confirms the production database and Vercel configuration.

## Repository audit

- Working tree: clean.
- `origin/main`: `d1082a2`.
- `origin/phase-1b-implementation`: `b20a3f3`.
- Divergence: feature branch is 18 commits ahead; main has no commits missing from the feature branch.
- No reset, rebase, force-push, branch deletion, or discarded commit was performed.

## Implemented now

- Phase 1A storefront and application foundation.
- Payment and inventory state machine hardening.
- Atomic payment state claims and safe callback handling.
- App Router public catalog routes with SEO metadata and JSON-LD.
- Cart, checkout, and order routes.
- Order authorization correction, safe login redirects, and anti-enumeration behavior.
- Storefront cleanup and accessibility improvements.
- Non-destructive admin account recovery safeguards and transactional audit behavior.
- Authentication hardening, including runtime JWT secret validation.
- Prisma migrations for the current schema.

## Not implemented yet

The following are design/operations blueprints only and must not be represented as shipped product features:

- BulkSMSBD OTP integration and account verification rollout.
- Admin operations dashboard and A4 print workflow.

## Verification results

| Check | Result |
|---|---|
| TypeScript (`npx tsc --noEmit`) | Passed |
| ESLint (`npm run lint`) | Passed |
| Full tests (`npm test`) | Passed: 43/43 |
| Production build (`npm run build`) | Passed |
| Prisma migration status | Passed: database schema is up to date |

Prisma readiness was checked with the non-destructive `prisma migrate status` command against the configured PostgreSQL database. No reset, seed, `db push`, destructive write, or admin upsert was run.

## Database, auth, and Vercel blockers

### Database

No migration drift was reported by the readiness check. Before merging, the owner must still confirm that this is the intended production database and that the deployment will use the same approved database configuration. Production migrations must be applied with:

```bash
npx prisma migrate deploy
```

### Authentication

The application requires a production `JWT_SECRET` of at least 32 characters. The configured Production value was verified present and 44 characters long without exposing it. No credential was guessed or tested.

### Vercel

Vercel Project Environment Variables currently show these values present in Production:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `OTP_SECRET`
- `NEXT_PUBLIC_APP_URL`

`CRON_SECRET` is not present and is a release blocker for the scheduled order-expiration endpoint if that endpoint is enabled in production. It is unrelated to login/signup.

Preview and Production scopes are separate. Preview login/signup testing requires separate safe Preview values for the required database/auth variables; Production values do not automatically apply to Preview. The current feature-branch Preview deployment is available and reports `Ready`, but Preview variable coverage still needs owner confirmation before authentication testing.

The earlier Production runtime incident showed Prisma initialization failures when `DATABASE_URL` was unavailable to the deployed runtime. Environment variables must be present before creating the release deployment; changing a variable does not retroactively update an existing deployment.

## Required owner actions before merge

1. Review the pull request from `phase-1b-implementation` into `main`.
2. Confirm the configured production database is the intended database and run `npx prisma migrate deploy` in the approved release environment.
3. Add and verify Production `CRON_SECRET` if scheduled order expiration is enabled.
4. If Preview auth testing is required, configure separate safe Preview values for `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `OTP_SECRET`, and `NEXT_PUBLIC_APP_URL`; configure Preview `CRON_SECRET` if Preview cron testing is required.
5. Confirm a fresh release deployment will be created after all required variables are configured.
6. After review and database confirmation, choose **Squash and merge**. Do not merge before these confirmations.

## Exact release checklist

- [ ] Review the pull request and changed files.
- [ ] Confirm the target database and migration history.
- [ ] Run `prisma migrate deploy` against the approved production database.
- [ ] Confirm Production environment variables, including `CRON_SECRET`.
- [ ] Confirm separate Preview variables if Preview authentication testing is needed.
- [ ] Confirm the release deployment is created after environment-variable changes.
- [ ] Verify login and signup with secured, known test credentials only.
- [ ] Verify wrong credentials return HTTP 401.
- [ ] Review runtime logs for sanitized errors only.
- [ ] Confirm payment callbacks, order authorization, and inventory transitions in the approved test plan.
- [ ] Click **Squash and merge** only after all blockers are cleared.
- [ ] Deploy production only through the approved release process after merge.

