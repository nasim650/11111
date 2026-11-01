# Source Directory Guidelines

## Directory Structure
- `app/`: Next.js App Router specific files (`page.tsx`, `layout.tsx`, `api/`).
- `components/ui/`: Reusable, foundational UI components built on top of Radix UI (shadcn/ui style).
- `components/pages/`: Page-level components.
- `components/shared/`: Shared components used across different features.
- `components/layout/`: Layout components like `Navbar`, `Footer`.
- `hooks/`: Custom React hooks (e.g., `use-toast`, `use-mobile`).
- `lib/`: Utility functions, database instances, api helpers, auth helpers, validation logic.

## Conventions
- **Client vs Server Components**: Route handlers in `app/` should default to Server Components. Components in `components/pages/` might need `"use client"` if they rely on hooks or state.
- **Styling**: Use the `cn` utility from `src/lib/utils.ts` for conditionally merging Tailwind classes.
- **Database**: Access the database via the Prisma client configured in `src/lib/db.ts` (or similar). Do not create new Prisma clients in components or API routes.
