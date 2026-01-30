# Configuration & Constants Management

## 1. Environment Variables (.env)

- **Consistency:** All environment variables must be defined in one place (e.g., `packages/config-client` or a central `.env` on the root).
- **Validation:** Use a validation schema (like Zod) to ensure all required `.env` variables are present and of the correct type during startup.
- **Usage:** NEVER use `process.env.VAR` directly in business logic. Always inject it via a config service or import it from a central config module.

## 2. Centralized Constants

To avoid hard-coded strings and ensure consistency:

- **Shared Constants:** Values used by both frontend and backend (e.g., `USER_STATUS`, `USER_PROFILE_TYPE`) MUST go into `packages/contracts/src/constants/`.
- **Backend-Only:** Application-specific logic (e.g., DB collection names) stay in `apps/backend/src/shared/constants/`.

## 3. Single Source of Truth Pattern (Mandatory)

To avoid repetition and ensure consistency, all constant files in `packages/contracts` MUST follow this pattern:

1. **The Array (Source):** Define a `const` array.
2. **The Type:** Infer the type from the array.
3. **The Object:** Generate a runtime object from the array for dot-notation usage.

```typescript
// Example: user-status.ts
export const USER_STATUS_ENUM = ["ACTIVE", "PENDING"] as const;
export type UserStatusType = (typeof USER_STATUS_ENUM)[number];

export const USER_STATUS = USER_STATUS_ENUM.reduce(
  (acc, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in UserStatusType]: K },
);
```

## 4. Constant Naming

- **Arrays/Enums:** `SCREAMING_SNAKE_CASE_ENUM` (e.g., `USER_STATUS_ENUM`).
- **Runtime Objects:** `SCREAMING_SNAKE_CASE` (e.g., `USER_STATUS`).
- **Types:** `PascalCaseType` (e.g., `UserStatusType`).
