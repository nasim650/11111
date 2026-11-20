# Future Production Migration Checklist

This checklist is intentionally deferred. It was not executed during the audit.

## Dedicated services

- [ ] Create a dedicated Production owner/account and least-privilege database user.
- [ ] Create a new Production Neon PostgreSQL database.
- [ ] Configure pooled `DATABASE_URL` and direct `DIRECT_URL`.
- [ ] Configure a dedicated Redis instance.
- [ ] Configure a dedicated Cloudinary/storage account and persistent upload policy.
- [ ] Obtain approved production SMS/OTP credentials.
- [ ] Obtain approved SSLCOMMERZ production credentials.
- [ ] Configure final domain, DNS, HTTPS, and callback URLs.

## Application and database

- [ ] Set Vercel Production-only environment variables through the secret manager.
- [ ] Keep Preview and Development database URLs isolated from Production.
- [ ] Run `prisma migrate deploy` against the new Production database.
- [ ] Verify migration status and foreign-key/index integrity.
- [ ] Import approved seed/catalog data through a reviewed migration process.
- [ ] Migrate product images to persistent Production storage.
- [ ] Configure backups, retention, restore testing, and monitoring.

## Release verification

- [ ] Run PostgreSQL COD checkout and rollback tests.
- [ ] Run admin/customer status synchronization tests.
- [ ] Run payment sandbox verification, then production credential smoke tests with approval.
- [ ] Run security, build, and browser smoke tests.
- [ ] Verify no `.env` or secret files are tracked.
- [ ] Deploy Preview first with isolated Preview services.
- [ ] Obtain explicit approval before Production deployment.
- [ ] Perform post-deployment customer, admin, payment, storage, and monitoring smoke tests.
