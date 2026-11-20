# 🔑 Environment Variables Reference — Khati Khadyo

| Variable | Required | Default / Description | Example |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Yes | SQLite or PostgreSQL connection string | `file:../db/custom.db` or `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Yes | Secret key used to sign authentication JWT tokens | `super-secret-jwt-key-2026` |
| `OTP_SECRET` | Required for OTP | Separate 32+ character secret used to hash OTP codes | Generate a unique random value |
| `SMS_PROVIDER` | Recommended for OTP | Provider selection: `"cloudsmsbd"` (Cloud SMS BD) or `"bulksmsbd"` (BulkSMSBD) | `"cloudsmsbd"` |
| `CLOUDSMSBD_API_KEY` | Required when `SMS_PROVIDER=cloudsmsbd` | Cloud SMS BD (`p1.cloudsmsbd.com`) API secret key (Server-only, never expose to client) | — (Secret, never commit) |
| `CLOUDSMSBD_SENDER_ID` | Required when `SMS_PROVIDER=cloudsmsbd` | BTRC-approved Masking / Sender ID registered on Cloud SMS BD | `KHATIKHADYO` |
| `CLOUDSMSBD_API_URL` | Optional | Custom endpoint URL for Cloud SMS BD | `https://p1.cloudsmsbd.com/api/sms` |
| `BULKSMSBD_API_KEY` | Required when `SMS_PROVIDER=bulksmsbd` | BulkSMSBD API secret key | — (Secret, never commit) |
| `BULKSMSBD_SENDER_ID` | Required when `SMS_PROVIDER=bulksmsbd` | Approved Sender ID registered on BulkSMSBD | `KHATI_KHADYO` |
| `SMS_GATEWAY_URL` | Optional fallback | Generic SMS provider JSON endpoint. The app sends `{ to, from, message }`. | `https://provider.example/messages` |
| `SMS_GATEWAY_TOKEN` | Required by most SMS providers | Bearer token sent to the SMS gateway | — |
| `SMS_SENDER_ID` | Optional/provider-specific | Registered sender ID | `KHATIKHADYO` |
| `REDIS_URL` | Required in production | Shared Redis instance for distributed rate limiting/cache | `rediss://...` |
| `NEXTAUTH_SECRET` | Yes | Secret key for NextAuth encryption | `super-secret-nextauth-key-2026` |
| `NEXTAUTH_URL` | Optional | Canonical URL of application | `http://localhost:3000` or `https://khatikhadyo.com` |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary account cloud name | `khati-khadyo-cloud` |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API key | `1234567890` |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret | `abcdef123456789` |
| `SSLCOMMERZ_STORE_ID` | Optional | SSLCOMMERZ Store ID | `khati001live` |
| `SSLCOMMERZ_STORE_PASSWORD` | Optional | SSLCOMMERZ Store Password | `store_password_123` |
| `SSLCOMMERZ_IS_LIVE` | Required for live gateway | Set to `"true"` only after SSLCommerz live approval | `"false"` |

## 📦 Database Migrations Deployment

When deploying to production (Vercel, Railway, Render, etc.), make sure all pending Prisma migrations are deployed to PostgreSQL so that all required schema columns (such as `reservationExpiresAt`, `stockReserved`, `couponReleased`, `guestAccessTokenHash`, and `guestAccessExpiresAt` on `Order`) exist:

```bash
# Apply all pending migrations to production DATABASE_URL
npm run deploy:migrate
# Or directly:
npx prisma migrate deploy
```

> ⚠️ **Note:** If migrations are not applied, Prisma will return error `P2022` on order placement. `POST /api/orders` contains defensive logging to clearly identify `P2022` when schema migrations are missing.

