# 📖 Operations Runbook — Khati Khadyo

This runbook provides step-by-step procedures for common operational tasks and troubleshooting.

---

## 🛠️ Common Operations

### 1. Database Migrations & Schema Updates
When updating `prisma/schema.prisma`:
```bash
# Generate updated client types
npx prisma generate

# Apply schema changes to database
npx prisma db push
```

### 2. Seeding Emergency Production Admin User
To create an initial admin user directly in the database:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('AdminPassword123!', 12);
  await prisma.user.upsert({
    where: { email: 'admin@khatikhadyo.com' },
    update: { role: 'admin', isActive: true },
    create: { name: 'Admin', email: 'admin@khatikhadyo.com', password: hash, role: 'admin', isActive: true }
  });
  console.log('Admin user ensured');
}
main().finally(() => prisma.\$disconnect());
"
```

---

## 🚨 Incident Response & Troubleshooting

### Issue 1: High Latency or Memory Spikes
- **Diagnostic**: Check active Node processes using `top` or `pm2 status`.
- **Resolution**: Restart the server process using `npm run start` or `pm2 restart khati-khadyo`.

### Issue 2: SSLCOMMERZ Callback Failures
- **Diagnostic**: Check `/api/payments/sslcommerz/ipn` server logs.
- **Resolution**: Verify `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD` in `.env`.
