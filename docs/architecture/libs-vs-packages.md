# Monorepo Structure: Libs vs Packages

## 📌 Rules and Boundaries

This document defines the clear boundary between `libs/` and `packages/` in the Banijjik monorepo to prevent "dependency spaghetti."

### 1. `packages/` (The "Published" Artifacts)

- **Consumable by:** Backend, Frontend, Mobile, and other packages.
- **Content:** API Contracts, Shared Zod Schemas, i18n JSONs, UI Kits, and Themes.
- **Rule:** Must be runtime-agnostic (if possible) or strictly defined for multi-platform use.
- **Naming:** Follows the `@banijjik/*` scope.

### 2. `libs/` (The Technical Core)

- **Consumable by:** Backend ONLY (usually).
- **Content:** Database utilities, Auth helpers, Logger, Event Bus implementations.
- **Rule:** Contains specialized backend logic that shouldn't leak to the frontend.
- **Naming:** Usually internal technical utilities.

---

## Decision Matrix

| Context                    | Recommended Location  | Rationale                |
| :------------------------- | :-------------------- | :----------------------- |
| API Request/Response Types | `packages/contracts`  | Shared between FE and BE |
| Validation Logic (Zod)     | `packages/validation` | Shared between FE and BE |
| Database Seeding Logic     | `libs/db-utils`       | Backend only             |
| Authentication Logic       | `libs/auth-utils`     | Backend only             |
| UI Components              | `packages/ui-kit`     | Shared between Web apps  |

> [!IMPORTANT]
> When in doubt, ask: "Does the frontend need this to talk to the backend?"
> If **YES** → `packages/`. If **NO** → `libs/`.
