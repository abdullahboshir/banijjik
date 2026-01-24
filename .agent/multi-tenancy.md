# Multi-Tenancy & Isolation Strategy

## 1. Tenant Types

### Shared Tenant

- **Infrastructure:** Shared Database, Shared Server.
- **Isolation:** Record-level isolation using `organization_id`.
- **Rule:** Every single query MUST include `organization_id` (enforced via middleware or repository layer).

### Dedicated Tenant

- **Infrastructure:** Exclusive Database, potentially exclusive server/file storage.
- **Isolation:** Physical isolation (Database-per-tenant).
- **Rule:** Connection string must be dynamically switched based on the request context.

## 2. Platform vs Customer Data

- **Platform DB:** Stores tenants, subscription plans, business type configurations, and global settings.
- **Product DB:** Stores business-specific data (users, invoices, inventory).
  - _Note:_ In shared mode, many organizations live in one product DB. In dedicated mode, one organization has its own product DB.

## 3. Strict Boundary Rules

- **Zero Leakage:** Cross-tenant data access is a critical failure.
- **File Storage:** Files should be stored in paths like `/storage/{tenant_id}/{file_id}`.
- **IAM Consistency:** Identities must be unique across the platform (for global login) but membership is organization-specific.
