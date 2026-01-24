# Monorepo Boundaries & Import/Export Rules

## 1. Package Structure

- **apps/**: Deployment units (backend, frontend, mobile).
- **libs/**: Technical utilities (e.g., `libs/logger`, `libs/db-utils`).
- **packages/**: Reusable business logic or shared types.

## 2. Hierarchy-Based Export Naming

To maintain clean separation in a monorepo, all exports must follow a hierarchy-identifying naming convention:

### Backend Exports

- Format: `Backend[Domain][Layer][Type]`
- Example: `BackendIdentityApplicationService`, `BackendBillingMongooseModel`.

### Frontend Exports

- Format: `Frontend[Domain][Component/Service]`
- Example: `FrontendAcademicExamList`, `FrontendAuthLoginService`.

### Shared Exports

- Format: `Shared[Domain][Type]`
- Example: `SharedUserInterface`, `SharedRoleConstant`.

## 3. Strict Import Boundaries

- **No Cross-App Imports:** Apps never import from each other directly.
- **Layer Hierarchy:** `infrastructure` -> `application` -> `domain`. Imports must only flow towards the `domain`.
- **Package Priority:** Any code needed in multiple `apps` or `core` domains MUST be moved to a `package/`.

## 4. Enforcement

- Use TypeScript path aliases (e.g., `@app/core`, `@shared/types`).
- Naming discipline is mandatory. Avoid generic names like `Service` or `Component` without a context prefix.
