# 🛡️ Admin Account Recovery Runbook — Khati Khadyo

**Project:** Khati Khadyo (খাঁটি খাদ্য) — Authentic Bangladeshi Food E-Commerce  
**Document Version:** 1.0.0  
**Effective Date:** 2026-11-01  
**Applicability:** Production, Staging, and Local Environments  

---

## 1. Critical Warning: Never Run Destructive Seed in Production

> [!CAUTION]
> **DO NOT RUN `prisma db seed` OR `npx tsx prisma/seed.ts` IN PRODUCTION.**  
> The standard development seed script (`prisma/seed.ts`) contains table truncation commands (`deleteMany()`) designed to reset development environments. Running it in production will wipe customer orders, payments, reviews, and categories, while attempting to create an insecure default password (`admin123`).

To safely create or recover an administrative account without deleting or modifying any other database records, follow the non-destructive procedure documented below.

---

## 2. Safe Admin Upsert Tool (`scripts/safe-upsert-admin.ts`)

The dedicated utility [`scripts/safe-upsert-admin.ts`](file:///Users/nasimp/Desktop/11111/1/scripts/safe-upsert-admin.ts) performs an **isolated, non-destructive upsert**:
- If the user does not exist: creates a new user with `role: 'admin'`, `isActive: true`, `isVerified: true`.
- If the user already exists: safely updates their `role` to `'admin'`, activates the account (`isActive: true`), rotates their password hash with bcrypt (12 rounds), and increments `sessionVersion` to immediately invalidate all previously issued sessions.
- **Data Safety Guarantee:** Performs zero `deleteMany`, `truncate`, drop, or cascade operations. All orders, products, and customer records remain 100% untouched.
- **Production Guard:** Requires `CONFIRM_SAFE_ADMIN_UPSERT=true` whenever `NODE_ENV=production` or `VERCEL_ENV=production`.
- **Zero Log Leakage:** Plaintext passwords are never logged or stored. Terminal outputs only a masked email address (e.g. `a***n@khatikhadyo.com`).

---

## 3. How to Execute Safe Admin Upsert

### Option A: Local Terminal Connected to Remote PostgreSQL (Recommended)

To prevent passwords from being recorded in shell history files (`~/.zsh_history` or `~/.bash_history`), use `read -s` to prompt for credentials securely:

```bash
# 1. Navigate to the project root directory
cd 1

# 2. Prompt for credentials interactively without echoing to the screen
read -p "Enter Admin Email: " ADMIN_EMAIL
read -s -p "Enter Admin Password (min 8 chars): " ADMIN_PASSWORD
echo ""

# 3. For Production, confirm the safety guard
CONFIRM_SAFE_ADMIN_UPSERT="true"

# 4. Execute the safe upsert tool
ADMIN_EMAIL="$ADMIN_EMAIL" \
ADMIN_PASSWORD="$ADMIN_PASSWORD" \
CONFIRM_SAFE_ADMIN_UPSERT="$CONFIRM_SAFE_ADMIN_UPSERT" \
npm run admin:upsert-safe

# 5. Clear sensitive shell variables immediately
unset ADMIN_EMAIL ADMIN_PASSWORD CONFIRM_SAFE_ADMIN_UPSERT
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

### Option B: Execution via One-Off Secure Environment File

If executing in CI/CD or controlled maintenance shells, create a temporary env file with restrictive file permissions:

```bash
# 1. Create temporary file with restricted permissions (read-only for owner)
umask 077
cat << 'EOF' > .env.admin-temp
ADMIN_EMAIL="admin@khatikhadyo.com"
ADMIN_PASSWORD="YourSecurePasswordHere123!"
CONFIRM_SAFE_ADMIN_UPSERT="true"
EOF

# 2. Run the upsert using the temporary configuration
node --env-file=.env.admin-temp --loader ./scripts/test-loader.mjs scripts/safe-upsert-admin.ts

# 3. Immediately shred/delete the temporary file
rm -f .env.admin-temp
```

---

## 4. Admin Password Rotation Procedure

Whenever an admin password must be rotated:
1. Re-run `npm run admin:upsert-safe` with the existing `ADMIN_EMAIL` and the new `ADMIN_PASSWORD`.
2. The script will automatically:
   - Compute a new bcrypt hash with 12 salt rounds.
   - Update the `password` field for the user.
   - Increment `sessionVersion`.
3. Because `sessionVersion` is incremented, any existing JWT tokens previously held by the administrator will immediately fail token validation, forcing a clean re-login with the new password.

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
