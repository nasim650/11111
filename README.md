# 🌾 Khati Khadyo — Authentic Bangladeshi Food E-Commerce Platform

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

**Khati Khadyo** is an enterprise-grade e-commerce platform built to deliver authentic, chemical-free Bangladeshi food products directly from verified producers to consumers across Bangladesh.

---

## 🌟 Key Features

### 🛍️ Customer Storefront
- **Dynamic Homepage**: High-impact hero banners, category grids, flash sales, featured & new arrivals sections, trust badges, verified customer reviews, and responsive footer.
- **Product Catalog & Search**: Instant autocomplete search, multi-faceted category filtering, price sorting (Newest, Price Low↔High, Best Selling), and availability badges.
- **Product Details**: Image gallery, variant selector (weight/packaging), stock status indicators, trust badges, delivery rules, return policies, and verified customer reviews.
- **Shopping Cart**: Real-time cart workspace with local storage persistence for guests and server synchronization upon login, instant coupon discount validation, and a mobile bottom sheet summary drawer.
- **Enterprise Multi-Step Checkout**: 4-Step checkout wizard (Shipping Address, Delivery Method, Payment Selection, Order Review) with sticky order summary and mobile bottom sheet drawer.
- **Payment Integrations**: SSLCOMMERZ gateway integration (Cards, Mobile Financial Services) + Cash on Delivery (COD).
- **Order Tracking & Receipts**: Step-by-step order tracking timeline (Placed → Confirmed → Processing → Shipped → Delivered) and printable invoice receipts.
- **Customer Account**: Address book management, profile updates, and order history with re-order capabilities.

### 🏢 Admin CMS & Operations
- **Real-Time KPI Dashboard**: Live metrics for Today's Sales, Total Orders, Pending Orders, Revenue, and Low Stock Alerts.
- **Catalog Management**: Complete Product CRUD with image uploads, Category CRUD with icon and menu controls, Banner Management, and Homepage Builder.
- **Enterprise Media Library**: Drag-and-drop asset management, automatic WebP optimization, and instant public image URL generation.
- **Order & Customer Management**: Lifecycle status updates (Confirm, Pack, Ship, Deliver, Cancel), courier assignments, customer directory, and read-only audit logging.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | Full-stack React framework with SSR and static generation |
| **Language** | TypeScript 5.9 | End-to-end type safety |
| **Styling** | Tailwind CSS v4 + Shadcn/UI | Modern design tokens, responsive UI primitives, and glassmorphism |
| **Database ORM** | Prisma ORM 6.19 | Type-safe database queries and migrations |
| **Database Engine** | SQLite / PostgreSQL | ACID-compliant relational persistence |
| **Authentication** | JOSE JWT + bcryptjs | Secure bearer token auth and password hashing |
| **Validation** | Zod 4 | Strict input and schema validation |
| **Animations** | Framer Motion | Smooth UI micro-interactions |

---

## 🚦 Getting Started

### Prerequisites
- Node.js `20.x` or later
- npm or bun

### Installation

1. **Clone the repository**:
   ```bash
   cd 1
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   DATABASE_URL="file:../db/custom.db"
   JWT_SECRET="khati-khadyo-secret-key-2026-bangladesh"
   NEXTAUTH_SECRET="khati-khadyo-nextauth-secret-2026"
   ```

4. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

---

## 🛠️ Available Scripts

- `npm run dev` — Starts Next.js development server on port 3000
- `npm run build` — Builds the production bundle
- `npm run start` — Runs the production server
- `npm run lint` — Runs ESLint static analysis
- `npx tsc --noEmit` — Performs TypeScript type checking
- `npx prisma generate` — Generates Prisma Client types
- `npx prisma db push` — Pushes database schema changes

---

## 📄 License

Proprietary. All rights reserved © Khati Khadyo 2026.
