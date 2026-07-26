# 🔑 Environment Variables Reference — Khati Khadyo

| Variable | Required | Default / Description | Example |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Yes | SQLite or PostgreSQL connection string | `file:../db/custom.db` or `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Yes | Secret key used to sign authentication JWT tokens | `super-secret-jwt-key-2026` |
| `NEXTAUTH_SECRET` | Yes | Secret key for NextAuth encryption | `super-secret-nextauth-key-2026` |
| `NEXTAUTH_URL` | Optional | Canonical URL of application | `http://localhost:3000` or `https://khatikhadyo.com` |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary account cloud name | `khati-khadyo-cloud` |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API key | `1234567890` |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret | `abcdef123456789` |
| `SSLCOMMERZ_STORE_ID` | Optional | SSLCOMMERZ Store ID | `khati001live` |
| `SSLCOMMERZ_STORE_PASSWORD` | Optional | SSLCOMMERZ Store Password | `store_password_123` |
| `SSLCOMMERZ_IS_SANDBOX` | Optional | Set to `"true"` for sandbox testing | `"true"` |
