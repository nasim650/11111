# 🔒 Security Policy — Khati Khadyo

We prioritize data security and protection of customer information.

---

## 🛡️ Implemented Security Controls

- **Authentication**: JWT bearer tokens signed using HMAC-SHA256 (`JOSE` library) with 7-day expiration.
- **Password Hashing**: Passwords stored as salt-hashed strings using `bcryptjs` (cost factor 12).
- **SQL Injection Prevention**: All queries pass through Prisma ORM using parameterized queries.
- **XSS Prevention**: React automatically escapes rendered values. Input parameters sanitized via Zod.
- **RBAC**: Protected routes enforce Role-Based Access Control (`admin` vs `customer` roles).
- **Sensitive Data Filtering**: Passwords and secret keys excluded from API response serializations.

---

## 🚨 Reporting Vulnerabilities

If you discover a security vulnerability, please send details to `security@khatikhadyo.com`.
