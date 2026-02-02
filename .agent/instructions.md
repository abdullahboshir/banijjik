# Banijjik SaaS: Core Instructions & Architectural Rules

## 1. Product Identity & Global Strategy

- **Vision:** A single multi-tenant SaaS product serving multiple industries (Coaching, Gym, Clinic, Hostel, etc.).
- **Business Model:** Subscription-based, long-term scalable, one codebase for many customers.
- **Mental Model:** "Product, not Service." "Organization is root."
- **Dynamic Industries:** Fully dynamic business addition from the platform. Coaching/Gym/etc. are configurations, not code.
- **Performance:** The system must be extremely fast.
- **I18n:** Support for **Bangla (BN)** and **English (EN)** is mandatory.

## 2. Architectural Principles (Modular Monolith)

- **Pattern:** Clean Modular Monolithic DDD architecture.
- **Pure DDD (Behavioral):** Domain Entities MUST be logic-rich TypeScript classes. Anemic models (interfaces only) are forbidden for core entities.
- **Technology Agnostic Domain:** The Domain Layer MUST NOT import or reference ANY infrastructure technology (Mongoose, Prisma, Express, JWT libraries, etc.).
- **Dependency Inversion (DIP):** Dependencies must always flow towards the **Domain**. Infrastructure depends on Domain; Domain depends on NOTHING.
- **Scalability:** Shared vs Dedicated tenant types.
- **Centralized Configuration:** No hard-coded values. Everything from `.env` or centralized constants.
- **Strict Monorepo Boundaries:** Clean import/export using packages for shared code.
- **Naming Protocol: Organization vs Tenant:**
  - **Organization (Domain/Business):** Use this for ALL business logic, entities, UI, and routing. It is the single ubiquitous name for the client entity (e.g., `OrganizationService`, `organizationId`).
  - **Tenant (Infrastructure/Technical):** Use this ONLY for the underlying multi-tenancy mechanism (e.g., `TenantMiddleware`, `TenantDatabaseResolver`).
  - **The Rule:** You manage **Organizations**, but you isolate data by **Tenants**.

## 3. Route & Context Architecture

To avoid naming confusion, follow this hierarchy:

1. **Platform Level (The SaaS Provider):**
   - **Folder:** `/src/routes/platform/`
   - **Scope:** Global management (managing organizations, global billing, system configs).
   - **Primary Entity:** `Platform`, `System`.
2. **Organization Level (The Client/Tenant):**
   - **Folder:** `/src/routes/organization/`
   - **Scope:** Daily operations of the specific coaching, gym, or clinic.
   - **Primary Entity:** `Organization`.

## 3. Explicit Naming for Settings (No Confusion)

To avoid ambiguity between different types of configuration, use these specific names:

- **SystemSettings:** Internal system-level configurations managed by developers (e.g., Mail, Logs, Cron).
- **PlatformSettings:** Product-level business rules managed by the SaaS owner (e.g., Feature Catalog, Subscription Plans, Business Type registry).
- **BusinessSettings:** Tenant-level specialized rules managed by individual organization owners (e.g., Branding, Invoice prefixes, Office hours).

## 4. Hierarchy-Based Naming & Separation

Classes and files must explicitly state their layer and domain to maintain strict hierarchy:

- **Pattern:** `[Domain][Layer][Type]`
- **Examples:**
  - `IdentityDomainService` (Domain Layer)
  - `IdentityApplicationService` (Application/Use Case Layer)
  - `IdentityMongooseRepository` (Infrastructure Layer)
  - `IdentityController` (API/Interface Layer)
- **Strict Rule:** Higher layers (Application) can call lower layers (Domain), never vice versa. Infrastructure must implement interfaces defined in Domain or Application.

## 6. Context Anatomy (The Core 4 Folders)

Every domain context MUST contain precisely these four folders. No exceptions:

- `domain/`: Enterprise logic.
  - **Entities:** Behavioral classes. **RULE:** MUST ONLY import enums/types/values from local `.vo` files. NO other external imports allowed.
  - **Value Objects (.vo):** Define local constants/types here. **RULE:** MUST import from `@banijjik/contracts` to bridge global types to the domain. **STRICT:** Hardcoding values here is forbidden. Always bridge from contracts.
  - **Repository Ports (Interfaces):** Defined here.
- `application/`: Orchestration logic.
  - **Use Cases / Services:** Orchestrates entities. **RULE:** Import Response DTOs from `@banijjik/contracts` and internal types from `domain/`.
  - **DTOs:** Request/Input contracts. **RULE:** MUST be inferred from Zod schemas imported from `@banijjik/validation`.
- `infrastructure/`: External implementations (Adapters).
  - **Persistence (Models):** Mongoose Models. **RULE:** MUST import types/enums/values directly from `@banijjik/contracts`.
  - **Mappers:** Bridges Model <-> Entity.
- `presentation/`: Interface layer.
  - **Controllers:** **RULE:** MUST use `catchAsync` wrapper for all handler methods. NO manual try-catch for standard flow.
  - **Routing:** **RULE:** MUST use `validateRequest` middleware with Zod schemas from `packages/validation` before hitting the controller.
  - **Transformers:** Converts Domain/Application data to Response DTOs (from `contracts`).

## 7. Central Source of Truth (SOT)

The `@banijjik/contracts` package is the **Absolute Source of Truth** for the entire project.

1. **Global Constants:** Every enum, status, or type-value MUST be defined in `packages/contracts/src/constants` first.
2. **Global Interfaces:** All API Response structures MUST be defined in `packages/contracts/src/api-interface`.
3. **Global Validation:** All business rules and request shapes MUST be defined as Zod schemas in `packages/validation`.
4. **Global Errors & i18n:** EVERY error code or localized message key MUST be defined in `packages/contracts/src/errors` or `packages/i18n` first. **RULE:** Hardcoded error message strings in business logic are FORBIDDEN. Use keys that map to BN/EN translations.

> [!IMPORTANT]
> **Zero-Hardcoding Flow:** If you need an enum, type, or specific value in the Domain:
>
> 1. Verify if it exists in `@banijjik/contracts`.
> 2. If it DOES NOT exist -> Add it to `contracts` first.
> 3. Import from `contracts` into a Domain Value Object (`.vo.ts`).
> 4. Use ONLY the `.vo` in your Entities/Services.
> 5. **Purity Workflow:**

- Add to `contracts` -> Import into `VO` -> Use in `Entity`.
- Add to `validation` -> Infer `DTO` -> Use in `UseCase`/`Controller`.
- Add to `contracts/errors` -> Use in `Controller`/`Middleware` for responses.

## 7. Multi-tenancy & Isolation

- **Shared:** record-level isolation via `organization_id`.
- **Dedicated:** Exclusive DB/Resources.
- **Strict Separation:** One business MUST NOT see another's data.

## 8. Industrial Seeding & IAM

- **Default Seeders:** Mandatory for System Roles, Platform Settings, and Super-Admin.
- **Roles:** `SUPER_ADMIN`, `OWNER`, `ADMIN`, `STAFF`, `VIEWER`.
- **Financials:** Zero tolerance for errors. Use precise math.

## 9. Development Workflow & Consistency

- **Configuration First:** Add to `.env` and validate before use.
- **Constants over Magic:** Never use raw strings for Roles, Actions, or Resources.
- **Clear Exports:** Source-identifying names (e.g., `BackendOrganizationService`).
- **Industrial Best Practices:** Standard logging, API versioning (v1), Swagger docs, and global error handling.
