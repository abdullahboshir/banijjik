# platform/entitlement: what an organization may use

`resolveOrgConfig`, the entitlement gate and `GET /orgs/{organizationId}/me/config` (10-MODULE-CATALOG sections 3, 6, 8; ADR-091).

- **Entity:** `ModuleOverride` (platform database, tenancy ORGANIZATION): `moduleKey`, `effect` (PLATFORM_GRANT, PLATFORM_REVOKE, TENANT_DISABLE), `reason`, `expiresAt?`; unique per `(organizationId, moduleKey, effect)`. An expired override is ignored at resolve time. No write endpoint yet: platform grants arrive with card 1.8, tenant disable with settings. Every writer must bump `Organization.configVersion` in the same transaction through the `ConfigVersionBumper` port.
- **Resolver:** `domain/module-resolution.ts` (steps 1 to 5), `domain/limits.ts` (step 6), `domain/config-sections.ts` (step 8), orchestrated by `application/org-config-resolver.ts`. PLATFORM modules never appear in a config. A package key without a registered manifest is ignored. Step 5 logs `config.module.droppedMissingDependency` and never enables a paid module.
- **Cache** (`application/org-config.service.ts`): key `org:{organizationId}:config:{configVersion}:{registryHash}:{packageCatalogVersion}:{templateVersion}`. `configVersion` is read fresh on every request by `tenantContext`; the package catalogue version is a hash of all ACTIVE `(packageId, version)` refreshed at most every 5 s (`PackageCatalogVersion`). The cached copy holds the subscription dates, and the access mode is computed from them on every read. A cached copy also carries `validUntil` (the earliest override expiry).
- **Gate:** `kernel/access/entitlement.middleware.ts`, mounted once in `routes/v1.ts`. `OrgConfigService` is its `OrgConfigReader`; `buildModuleEffectiveness` gates event handlers.
- **Template reader:** `InterimIndustryTemplateReader` allows every module and kind at version 0 until card 2.1 (`platform/industry`).
- **Public API** (`index.ts`): `registerEntitlementModels`, `entitlementManifest`, `buildOrgConfigService`, `buildModuleEffectiveness`, `buildEntitlementTenantRouter`.
- **Industry key:** only the template reader port and the organization config source touch it (ADR-033).
