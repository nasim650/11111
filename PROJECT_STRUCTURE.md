# 📁 Project Structure — Khati Khadyo

```
1/
├── db/
│   └── custom.db                 # SQLite local production/dev database
├── prisma/
│   └── schema.prisma             # Prisma database schema definition
├── public/
│   ├── uploads/                  # Uploaded product, category, and banner media
│   └── all_logo.png              # Primary brand logo
├── src/
│   ├── app/                      # Next.js App Router (pages & API endpoints)
│   │   ├── api/                  # 53 RESTful API route handlers
│   │   │   ├── addresses/        # Customer shipping addresses
│   │   │   ├── admin/            # Admin dashboard KPIs
│   │   │   ├── auth/             # Login, register, token verification
│   │   │   ├── banners/          # Promotional banner CMS
│   │   │   ├── cart/             # Shopping cart synchronization & coupons
│   │   │   ├── categories/       # Category hierarchy Management
│   │   │   ├── contact/          # Support contact messages
│   │   │   ├── coupons/          # Coupon validation & management
│   │   │   ├── media/            # Enterprise Media Library asset management
│   │   │   ├── orders/           # Order placement & status updates
│   │   │   ├── payments/         # SSLCOMMERZ gateway initialization & IPN
│   │   │   ├── policy-pages/     # CMS policy page content
│   │   │   ├── products/         # Product catalog & autocomplete suggestions
│   │   │   ├── reviews/          # Verified product reviews
│   │   │   ├── site-config/      # Global site settings
│   │   │   └── uploads/          # Multi-part image upload handler
│   │   ├── globals.css           # Tailwind CSS design system tokens
│   │   ├── layout.tsx            # Root layout wrapper with metadata
│   │   └── page.tsx              # Application entrypoint & page router
│   ├── components/
│   │   ├── layout/               # Layout components (Navbar, Footer)
│   │   ├── pages/                # Storefront & Admin page components
│   │   │   ├── admin/            # Admin subpages (Products, Orders, Banners)
│   │   │   ├── HomePage.tsx      # Premium storefront homepage
│   │   │   ├── CartPage.tsx      # Shopping cart workspace
│   │   │   ├── CheckoutPage.tsx  # Multi-step checkout wizard
│   │   │   ├── ProductDetailPage.tsx # Rich product detail page
│   │   │   ├── OrderDetailPage.tsx   # Order tracking & print view
│   │   │   └── ...               # Account, policy, login, register pages
│   │   └── ui/                   # Shadcn/UI primitive components
│   └── lib/
│       ├── api.ts                # authFetch client wrapper with JWT header
│       ├── auth.ts               # JOSE JWT & bcrypt password utilities
│       ├── prisma.ts             # Prisma Client singleton
│       ├── store.ts              # Zustand global application state
│       └── validation.ts         # Zod schemas for input validation
├── .env                          # Environment variables
├── next.config.ts                # Next.js configuration
├── package.json                  # Dependencies & npm scripts
└── tsconfig.json                 # TypeScript configuration
```
