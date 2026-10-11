import type { Router } from "express";
import type { PlatformAuditRecorder } from "../../../kernel/audit/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import type { ConfigVersionBumper } from "../../../kernel/tenancy/index.js";
import { InMemoryLruCache } from "../../../kernel/cache/index.js";
import type { PermissionGate } from "../../../kernel/access/index.js";
import type { ModuleEffectiveness } from "../../../kernel/events/index.js";
import type { ModuleRegistry } from "../../../kernel/modules/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import type { LimitGuard } from "../../../kernel/access/index.js";
import { OrgLimitGuard } from "./application/org-limit-guard.js";
import { buildPackageReader } from "../package/index.js";
import { buildSubscriptionReader } from "../saas-billing/index.js";
import { OrgConfigResolver } from "./application/org-config-resolver.js";
import { OrgConfigService } from "./application/org-config.service.js";
import { PackageCatalogVersion } from "./application/package-catalog-version.js";
import type {
  IndustryTemplateReader,
  OrganizationConfigSource,
} from "./application/ports/entitlement-ports.js";
import type {
  ModuleOverrideAdminRepository,
  OrganizationExistence,
  OverrideManifestCatalog,
} from "./application/ports/override-admin-ports.js";
import {
  CreateModuleOverrideUseCase,
  DeleteModuleOverrideUseCase,
  ListModuleOverridesUseCase,
} from "./application/use-cases/module-override-admin.use-cases.js";
import { MongoModuleOverrideAdminRepository } from "./infrastructure/mongo-module-override-admin.repository.js";
import { MongoOverrideUnitOfWork } from "./infrastructure/mongo-override-unit-of-work.js";
import { ModuleOverrideController } from "./presentation/module-override.controller.js";
import { buildModuleOverrideRouter } from "./presentation/module-override.router.js";
import { GetMyConfigUseCase } from "./application/use-cases/get-my-config.use-case.js";
import type { ResolvedOrgConfig } from "./domain/resolved-org-config.js";
import { InterimIndustryTemplateReader } from "./infrastructure/interim-industry-template-reader.js";
import { MongoModuleOverrideReader } from "./infrastructure/mongo-module-override.reader.js";
import { MeConfigController } from "./presentation/me-config.controller.js";
import { buildMeConfigRouter } from "./presentation/me-config.router.js";

export { registerEntitlementModels } from "./infrastructure/register-entitlement-models.js";
export { entitlementManifest } from "./module.manifest.js";
export type {
  IndustryTemplateReader,
  IndustryTemplateView,
  OrganizationConfigSnapshot,
  OrganizationConfigSource,
} from "./application/ports/entitlement-ports.js";
export type { EffectiveOrgConfig, OrgConfigService } from "./application/org-config.service.js";

export interface OrgConfigServiceOptions {
  readonly registry: ModuleRegistry;
  readonly clock: Clock;
  /** Implemented by core/organization, adapted in routes/v1.ts. */
  readonly organizations: OrganizationConfigSource;
  /** Defaults to the interim reader (all modules, all kinds) until card 2.1. */
  readonly templates?: IndustryTemplateReader;
}

/** The resolver behind a cache; it is the gate's OrgConfigReader and the event runner's source of truth. */
export function buildOrgConfigService(options: OrgConfigServiceOptions): OrgConfigService {
  const { registry, clock } = options;
  const packages = buildPackageReader();
  return new OrgConfigService({
    registry,
    resolver: new OrgConfigResolver({
      registry,
      subscriptions: buildSubscriptionReader(),
      packages,
      overrides: new MongoModuleOverrideReader(),
      clock,
    }),
    organizations: options.organizations,
    templates: options.templates ?? new InterimIndustryTemplateReader(),
    catalogVersion: new PackageCatalogVersion(packages, clock),
    configCache: new InMemoryLruCache<ResolvedOrgConfig>({ clock }),
    templateKeyCache: new InMemoryLruCache({ clock }),
    clock,
  });
}

/** Handlers of a module that is off for an organization do not run (ADR-049). */
export function buildModuleEffectiveness(service: OrgConfigService): ModuleEffectiveness {
  return {
    isEffective: (organizationId, moduleKey) =>
      service.isModuleEffective(organizationId, moduleKey),
  };
}

export interface EntitlementTenantRouterDependencies {
  readonly orgConfig: OrgConfigService;
  readonly permissions: Pick<PermissionGate, "describeCaller">;
}

/** `GET /orgs/{organizationId}/me/config`, mounted by routes/v1.ts behind the tenant pipeline. */
export function buildEntitlementTenantRouter(
  dependencies: EntitlementTenantRouterDependencies,
): Router {
  const controller = new MeConfigController({
    getMyConfig: new GetMyConfigUseCase(dependencies),
  });
  return buildMeConfigRouter(controller);
}

/** The kernel LimitGuard: counts are checked against the resolved limits of the request's organization (10 section 9). */
export function buildLimitGuard(orgConfig: OrgConfigService): LimitGuard {
  return new OrgLimitGuard(orgConfig);
}

export type { ModuleOverrideView } from "./application/ports/override-admin-ports.js";

export interface EntitlementPlatformRouterDependencies {
  readonly clock: Clock;
  readonly permission: PlatformPermissionMiddlewareFactory;
  readonly platformAudit: PlatformAuditRecorder;
  /** The registered manifests: only a CORE or OPTIONAL module with a manifest can be granted or revoked. */
  readonly manifests: OverrideManifestCatalog;
  /** Implemented by core/organization, wired in routes/v1.ts. */
  readonly organizations: OrganizationExistence;
  readonly configVersion: ConfigVersionBumper;
}

/** `/platform/organizations/{organizationId}/module-overrides`, mounted by routes/v1.ts behind `authenticatePlatform`. */
export function buildEntitlementPlatformRouter(
  dependencies: EntitlementPlatformRouterDependencies,
): Router {
  const shared = {
    overrides: new MongoModuleOverrideAdminRepository(),
    organizations: dependencies.organizations,
    manifests: dependencies.manifests,
    configVersion: dependencies.configVersion,
    unitOfWork: new MongoOverrideUnitOfWork(),
    platformAudit: dependencies.platformAudit,
    clock: dependencies.clock,
  };
  const controller = new ModuleOverrideController({
    listOverrides: new ListModuleOverridesUseCase(shared),
    createOverride: new CreateModuleOverrideUseCase(shared),
    deleteOverride: new DeleteModuleOverrideUseCase(shared),
  });
  return buildModuleOverrideRouter(controller, dependencies.permission);
}

/** Plain reader of the overrides of one organization for the tenant detail; the caller reads under runAsSystem. */
export function buildModuleOverrideLister(): Pick<ModuleOverrideAdminRepository, "list"> {
  return new MongoModuleOverrideAdminRepository();
}

export { PACKAGE_CATALOG_REFRESH_MILLISECONDS } from "./application/package-catalog-version.js";
