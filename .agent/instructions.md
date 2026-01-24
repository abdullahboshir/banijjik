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

## 3. Explicit Naming for Settings (No Confusion)

To avoid ambiguity between different types of configuration, use these specific names:

- **SystemSettings:** Internal system-level configurations managed by developers (e.g., Mail, Logs, Cron).
- **PlatformSettings:** Product-level business rules managed by the SaaS owner (e.g., Feature Catalog, Subscription Plans, Business Type registry).
- **BusinessSettings:** Tenant-level specialized rules managed by individual business owners (e.g., Branding, Invoice prefixes, Office hours).

## 4. Hierarchy-Based Naming & Separation

Classes and files must explicitly state their layer and domain to maintain strict hierarchy:

- **Pattern:** `[Domain][Layer][Type]`
- **Examples:**
  - `IdentityDomainService` (Domain Layer)
  - `IdentityApplicationService` (Application/Use Case Layer)
  - `IdentityMongooseRepository` (Infrastructure Layer)
  - `IdentityController` (API/Interface Layer)
- **Strict Rule:** Higher layers (Application) can call lower layers (Domain), never vice versa. Infrastructure must implement interfaces defined in Domain or Application.

## 5. Domain vs. Business Type

- **Business Type (Industry):** Coaching, Gym, Clinic. These are **DATA/CONFIG**, not folders.
- **Domain (Capability):** Auth, Organization, Billing, People, Academic. These are **CODE MODULES**.
- **Rule:** Folders represent **WHAT** the system does (Capability), not **WHO** uses it (Industry).

## 6. Backend Structure (apps/backend/src/core)

Layered structure within each domain module:

- `domain/`: Enterprise logic. Contains:
  - **Entities:** Behavioral classes.
  - **Value Objects:** Immutable objects representing domain concepts.
  - **Domain Services:** Logic involving multiple entities.
  - **Repository Ports (Interfaces):** MUST be defined here to invert dependency.
- `application/`: Application logic. Contains:
  - **Use Cases / Services:** Orchestrates entities and repository ports.
  - **DTOs:** Input/Output contracts.
- `infrastructure/`: External implementations. Contains:
  - **Persistence:** Mongoose/SQL Models and Repository Implementations.
  - **Mappers:** Conversions between Entity <-> Persistence Model.
  - **External Services:** Mailers, Third-party APIs.

### 6.1 The "Rule of Three" (Persistence Boundary)

Every persisted domain concept must have:

1. **Domain Entity (Class):** Holds behavior and state (in `domain/`).
2. **Infrastructure Model (Schema):** Optimized for storage (in `infrastructure/persistence/`).
3. **Mapper (Static Class):** Bridges Entity <-> Model (in `infrastructure/mappers/`).

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
