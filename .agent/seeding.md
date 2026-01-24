# Industrial Seeding & Initialization Standards

## 1. System-Level Seeders (Platform)

These are run once during system setup:

- **Role Definitions:** `SUPER_ADMIN`, `OWNER`, `ADMIN`, `STAFF`, `VIEWER`.
- **Feature Catalog:** List of all available capabilities (e.g., `academic`, `billing`, `inventory`).
- **Business Types:** Config for `coaching`, `gym`, `clinic`, etc. (Mapping which features they get by default).
- **Default Packages:** Trial, Basic, Premium subscription plans.
- **Initial Super-Admin:** The root user for the entire platform.

## 2. Tenant-Level Initialization

When a new organization is created, the system must trigger:

- **Organization Profile:** Base settings (Name, Logo, Tax Settings).
- **Role Instances:** Mapping system roles to the local organization.
- **Initial Admin:** The user who created the organization.
- **Default Settings:** Currency (BDT/USD), Language (BN/EN), Timezone.

## 3. Standard Pattern

- All seeders must be idempotent (can be run multiple times safely).
- Use environment variables for sensitive initial data (e.g., Super-Admin password).
