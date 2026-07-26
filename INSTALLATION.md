# 📥 Installation & Setup Guide — Khati Khadyo

Follow these steps to set up Khati Khadyo locally or on a staging server.

---

## 1. System Requirements

- **Node.js**: `v20.x` or higher
- **Package Manager**: `npm` (v10+) or `bun` (v1.1+)
- **Operating System**: Linux, macOS, or Windows WSL2

---

## 2. Step-by-Step Installation

### Step 1: Clone Repository & Navigate to Workspace
```bash
cd 1
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the root directory:
```env
DATABASE_URL="file:../db/custom.db"
JWT_SECRET="khati-khadyo-secret-key-2026-bangladesh"
NEXTAUTH_SECRET="khati-khadyo-nextauth-secret-2026"
```

### Step 4: Initialize Prisma Database
Generate the Prisma Client types:
```bash
npx prisma generate
```

Push schema changes if initializing a new database:
```bash
npx prisma db push
```

### Step 5: Start Development Server
```bash
npm run dev
```

Access the application at `http://localhost:3000`.

---

## 3. Verification Commands

Run the full verification suite:
```bash
# Type check
npx tsc --noEmit

# Linting
npm run lint

# Build production bundle
npm run build
```
