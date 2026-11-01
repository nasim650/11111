# 🛡️ Admin Account Recovery Runbook — Khati Khadyo

**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Document Version:** 1.1.0 (Hardened)  
**Effective Date:** 2026-11-01  
**Applicability:** Production, Staging, and Local Environments  

---

## 1. Critical Warning: Never Run Destructive Seed in Production

> [!CAUTION]
> **DO NOT RUN `prisma db seed` OR `npx tsx prisma/seed.ts` IN PRODUCTION.**  
> The standard development seed script (`prisma/seed.ts`) contains table truncation commands (`deleteMany()`) designed to reset development environments. Running it in production will wipe customer orders, payments, reviews, and categories, while attempting to create an insecure default password (`admin123`).

To safely create or recover an administrative account without deleting or modifying any other database records, follow the hardened, non-destructive procedure documented below.

---

## 2. Safe Admin Upsert Tool (`scripts/safe-upsert-admin.ts`)

The dedicated utility [`scripts/safe-upsert-admin.ts`](file:///Users/nasimp/Desktop/11111/1/scripts/safe-upsert-admin.ts) performs an **isolated, non-destructive, and fully transactional upsert**:
- **Mandatory Confirmation Guard:** Regardless of environment (`NODE_ENV`, `VERCEL_ENV`, local or remote), execution is strictly blocked unless `CONFIRM_SAFE_ADMIN_UPSERT=true` is provided.
- **Target Match Confirmation:** `CONFIRM_ADMIN_EMAIL` must be explicitly provided and must match `ADMIN_EMAIL` exactly before any database connection or query is initiated.
- **Atomic Transaction Boundary:** User creation/update, password hashing, `sessionVersion` increment, and audit logging execute within a single atomic Prisma transaction (`$transaction`).
- **Audit Rollback Guarantee:** If audit logging fails, the transaction immediately rolls back and NO user state changes persist.
- **Password Policy:** Minimum **12 characters** required; hashed with bcrypt (12 rounds).
- **Session Revocation on Rotation:** When rotating credentials for an existing admin, `sessionVersion` increments, invalidating all previously issued JWT tokens.
- **Data Safety Guarantee:** Zero `deleteMany`, `truncate`, drop, or cascade operations. All orders, products, and customer records remain 100% untouched.
- **Zero Log Leakage:** Plaintext passwords, tokens, database URLs, and full email addresses are never logged or stored. Terminal outputs only a masked email address (e.g. `a***n@khatikhadyo.com`).

---

## 3. How to Execute Safe Admin Upsert (Interactive Method Only)

To prevent passwords from being recorded in shell history files (`~/.zsh_history` or `~/.bash_history`), process tables, or persistent disk files, use the interactive `read -s` method in your terminal:

```bash
# 1. Navigate to the project root directory
cd 1

# 2. Prompt for credentials interactively without echoing passwords to the screen
read -p "Enter Target Admin Email: " ADMIN_EMAIL
read -p "Confirm Target Admin Email: " CONFIRM_ADMIN_EMAIL
read -s -p "Enter Admin Password (min 12 chars): " ADMIN_PASSWORD
echo ""

# 3. Explicitly execute in production context with mandatory confirmation
NODE_ENV=production \
ADMIN_EMAIL="$ADMIN_EMAIL" \
CONFIRM_ADMIN_EMAIL="$CONFIRM_ADMIN_EMAIL" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
CONFIRM_SAFE_ADMIN_UPSERT="true" \
npm run admin:upsert-safe

# 4. Immediately clear sensitive shell variables from memory
unset ADMIN_EMAIL CONFIRM_ADMIN_EMAIL ADMIN_PASSWORD CONFIRM_SAFE_ADMIN_UPSERT
```

**Expected Successful Output:**
```text
---------------------------------------------------------
✅ Safe Admin Account Recovery Succeeded
Action: CREATED  (or UPDATED)
Target: a***n@khatikhadyo.com
Role: admin
Active: true
---------------------------------------------------------
```

---

## 4. Admin Password Rotation Procedure

Whenever an admin password must be rotated:
1. Re-run `npm run admin:upsert-safe` following the interactive procedure above, supplying the existing admin email for both `ADMIN_EMAIL` and `CONFIRM_ADMIN_EMAIL`, alongside the new password ($\ge 12$ characters).
2. The script will automatically:
   - Compute a new bcrypt hash with 12 salt rounds.
   - Update the `password` field for the user in the database.
   - Increment `sessionVersion`.
   - Record an `ADMIN_ACCOUNT_UPDATED` entry in the `AuditLog` table.
3. Because `sessionVersion` is incremented, all existing JWT tokens previously held by the administrator will immediately fail token validation, forcing a clean re-login with the new password.

---

## 5. Admin Login Diagnosis & Error Resolution

When attempting to log in to the admin panel (`/login` or `POST /api/auth/login`), refer to the following status code mapping:

### `401 Unauthorized — "Invalid credentials"`
- **Meaning:** The submitted email/phone was not found in the database, the user has `isActive: false`, or the submitted password did not match the bcrypt hash.
- **Resolution:**
  - Verify that the safe admin upsert script was executed against the exact database specified by `DATABASE_URL`.
  - Confirm the email address spelling.
  - Re-run `npm run admin:upsert-safe` to re-set the password.

### `403 Forbidden — "CSRF validation failed"`
- **Meaning:** The request's `Origin` header does not match the `Host` header.
- **Resolution:**
  - Ensure you are accessing the login page directly through the canonical custom domain or preview URL (e.g. `https://khatikhadyo.com`), not via third-party iframe, mismatched proxy, or unforwarded port.

### `429 Too Many Requests — "Too many requests. Please try again later."`
- **Meaning:** The IP rate limiter has triggered because more than 5 login attempts occurred within a 60-second window.
- **Resolution:**
  - Wait 60 seconds for the rate limit window to reset.
  - In production with multi-instance serverless deployments, ensure `REDIS_URL` is configured for unified rate tracking.

### `500 Internal Server Error — "Unable to sign you in right now. Please try again later."`
- **Meaning:** Server-side exception during authentication.
- **Primary Causes & Checks:**
  1. **JWT Secret Missing or Weak:** If `JWT_SECRET` is missing in Vercel environment variables or is shorter than 32 characters, token generation throws `Error: JWT signing is not configured`. Ensure `JWT_SECRET` is configured in Vercel settings with $\ge 32$ characters.
  2. **Database Connection Dropped:** If `DATABASE_URL` is unreachable or the PostgreSQL compute endpoint is suspended, query execution fails. Check database status in the Neon/PostgreSQL console.
