# Configuration & Constants Management

## 1. Environment Variables (.env)

- **Consistency:** All environment variables must be defined in one place (e.g., `packages/config-client` or a central `.env` on the root).
- **Validation:** Use a validation schema (like Zod) to ensure all required `.env` variables are present and of the correct type during startup.
- **Usage:** NEVER use `process.env.VAR` directly in business logic. Always inject it via a config service or import it from a central config module.

## 2. Centralized Constants

To avoid hard-coded strings and ensure consistency:

- **Shared Constants:** Values used by both frontend and backend (e.g., `SystemRole`, `AuditAction`, `ResourceNames`) go into `packages/shared-types` or a dedicated `packages/constants`.
- **Backend-Only:** Application-specific logic (e.g., DB collection names, internal service IDs) stay in `apps/backend/src/shared/constants/`.
- **Frontend-Only:** UI-specific logic (e.g., CSS classes, Route names, LocalStorage keys) stay in `apps/frontend/src/shared/constants/`.

## 3. Forbidden Harcoding

- ❌ `if (user.role === 'admin')` -> ✅ `if (user.role === SystemRole.ADMIN)`
- ❌ `permission: 'create-invoice'` -> ✅ `permission: InvoiceActions.CREATE`
- ❌ `baseUrl: 'http://localhost:3000'` -> ✅ `baseUrl: config.api.baseUrl`

## 4. Constant Naming

- Use `SCREAMING_SNAKE_CASE` for values.
- Group related constants into `Objects` or `Enums` for better discoverability.
