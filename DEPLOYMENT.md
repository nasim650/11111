# 🚀 Deployment Guide — Khati Khadyo

This document outlines deployment protocols for production hosting on **Vercel**, **Docker/VPS**, or cloud platforms.

---

## 🌩️ Deployment on Vercel (Recommended)

1. **Connect Repository to Vercel**.
2. **Environment Variables Configuration**:
   - `DATABASE_URL`: Production PostgreSQL or SQLite connection string.
   - `JWT_SECRET`: High-entropy random 64-character secret.
   - `NEXTAUTH_SECRET`: High-entropy random secret.
   - `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name (if using Cloudinary).
   - `CLOUDINARY_API_KEY`: Cloudinary API Key.
   - `CLOUDINARY_API_SECRET`: Cloudinary API Secret.
   - `SSLCOMMERZ_STORE_ID`: SSLCOMMERZ Store ID.
   - `SSLCOMMERZ_STORE_PASSWORD`: SSLCOMMERZ Store Password.
3. **Build Command**:
   ```bash
   npx prisma generate && next build
   ```

---

## 🐳 Docker Deployment

### Dockerfile Example
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start"]
```

---

## 🔐 Production Pre-Flight Checklist

- [ ] All environment variables set in cloud secrets manager.
- [ ] Database SSL enabled for production DB connections.
- [ ] Reverse proxy (Nginx / Cloudflare) configured with HTTPS certificates.
- [ ] Build passes clean with zero errors: `npx tsc --noEmit && npm run lint && npm run build`.
