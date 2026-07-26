# 📜 Changelog — Khati Khadyo

All notable changes to this project will be documented in this file.

---

## [2.1.0] - 2026-07-26

### Added
- Enterprise multi-step checkout with sticky order summary and mobile bottom sheet summary drawer.
- Printable order invoice view (`OrderInvoicePage.tsx` / `OrderDetailPage.tsx`).
- New Arrivals section on Homepage with Sparkles badge and grid layout.
- Enterprise documentation suite: `PROJECT_STRUCTURE.md`, `INSTALLATION.md`, `DEPLOYMENT.md`, `ENVIRONMENT.md`, `CONTRIBUTING.md`, `SECURITY.md`, `RUNBOOK.md`, `PRODUCTION_AUDIT.md`.

### Changed
- Refactored `.env` configuration to support local SQLite database (`file:../db/custom.db`) with JWT secrets.
- Redesigned Homepage with high-impact hero banner, visual category grid, flash sales, and customer review cards.
- Optimized Navbar hydration guard for React 19 / ESLint compiler rules.

### Fixed
- Fixed Next.js font loader build crash by switching to CSS system font variables.
- Cleaned up debug `console.log` statements in contact and upload API routes.
- Resolved zero lint errors and zero TypeScript type check errors across all 53 API routes and storefront components.
