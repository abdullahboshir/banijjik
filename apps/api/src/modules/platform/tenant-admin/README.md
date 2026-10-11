# platform/tenant-admin: organizations in the platform panel

The operator's view of tenants (card 1.8a, 14-API.md section 7). PLATFORM class: platform routes only.

- **Endpoints** (`/api/v1/platform/organizations`, behind `authenticatePlatform`):
  `GET /?status=&q=` (summary with status, template key, subscription status, member count),
  `GET /{organizationId}` (adds subscription, active overrides, location count, owner with a masked identifier),
  `POST /{organizationId}/suspend` and `/reactivate` with `{ reason }`.
- **Permissions:** `platform.tenant.read` and `platform.tenant.suspend` (ADR-093), from the platform roles.
- **Owned elsewhere:** the status change is `SuspendOrganizationUseCase` / `ReactivateOrganizationUseCase` of
  `core/organization` (status, `configVersion` bump, event and platform audit entry in one transaction).
  Subscriptions come from `saas-billing`, overrides from `entitlement`, the owner contact from `core/iam`; the
  ports are wired in `routes/v1.ts`.
- **System access:** list and detail read members and locations (tenant data) under
  `runAsSystem(PLATFORM_ADMIN)`, which logs `system_access`; reads write no audit entry.
- **List cost:** three queries per page (organizations, one member aggregate, one subscription lookup).
- **Not here:** impersonation, industry-template change, closing an organization (later cards).
