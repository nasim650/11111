# 🤝 Contributing Guidelines — Khati Khadyo

Thank you for contributing to Khati Khadyo! Please follow these standards to ensure code quality and system maintainability.

---

## 📜 Development Rules

1. **Strict Type Safety**: No `any` types allowed. Write explicit TypeScript interfaces or infer types from Prisma/Zod.
2. **Component Conventions**:
   - Storefront UI components belong in `src/components/pages/` or `src/components/layout/`.
   - Reusable primitives belong in `src/components/ui/`.
3. **API Standards**:
   - All API routes in `src/app/api/` must return standard JSON response envelopes (`success`, `data`/`error`).
   - Validate all POST/PUT/PATCH request payloads with Zod schemas in `src/lib/validation.ts`.
4. **Zero-Error Verification**:
   Before submitting code, verify:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
