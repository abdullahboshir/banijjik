import type { ModuleManifest } from "@banijjik/contracts";
import type { StorageConfig } from "../config/index.js";
import type { RequestHandler, Router } from "express";
import type { PermissionGate, PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildFileModule, type FileModuleDependencies } from "../modules/core/file/index.js";
import { buildCustomFieldModule } from "../modules/core/custom-field/index.js";
import {
  buildConfigVersionBumper,
  buildLocationLookup,
  buildOrganizationConfigSource,
} from "../modules/core/organization/index.js";
import {
  buildSettingsTenantRouter,
  type LocationExistence,
} from "../modules/core/settings/index.js";
import { buildIndustryTemplateReader } from "../modules/platform/industry/index.js";
import {
  buildTenantModuleSwitch,
  type OrgConfigService,
} from "../modules/platform/entitlement/index.js";
import { buildAccountingTenantRouter } from "./accounting-tenant-router.js";
import { buildCatalogTenantRouter } from "./catalog-tenant-router.js";
import { buildContactTenantRouter } from "./contact-tenant-router.js";
import { buildExpenseTenantRouter } from "./expense-tenant-router.js";
import { MODULE_MANIFESTS } from "./module-registry.js";

export interface CoreTenantRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly registry: ModuleRegistry;
  readonly manifests: readonly ModuleManifest[];
  readonly storage: StorageConfig;
  /** Tests lower the quota, shorten the upload timeout or swap the storage. Production passes none. */
  readonly fileOverrides?: FileModuleDependencies["overrides"];
}

export interface CoreTenantRouters {
  readonly customFieldRouter: Router;
  readonly settingsRouter: Router;
  readonly fileRouter: Router;
  /** PUBLIC files without a session; mounted outside the tenant pipeline by routes/v1.ts. */
  readonly publicFileRouter: Router;
  readonly contactRouter: Router;
  readonly catalogRouter: Router;
  readonly accountingRouter: Router;
  readonly expenseRouter: Router;
}

function buildPlatformCoreRouters(
  input: CoreTenantRouterInput,
): Pick<
  CoreTenantRouters,
  "customFieldRouter" | "settingsRouter" | "fileRouter" | "publicFileRouter"
> {
  const { clock, audit, permission, orgConfig } = input;
  const customFieldRouter = buildCustomFieldModule({
    clock,
    audit,
    permission,
    orgConfig,
    registry: input.registry,
    configVersion: buildConfigVersionBumper(),
    productionManifests: MODULE_MANIFESTS,
  }).router;
  const settingsRouter = buildSettingsTenantRouter({
    permission,
    audit,
    orgConfig,
    configVersion: buildConfigVersionBumper(),
    manifests: input.manifests,
    locations: activeLocationExistence(),
    modules: buildTenantModuleSwitch({
      registry: input.registry,
      clock,
      templates: buildIndustryTemplateReader(clock),
      organizations: buildOrganizationConfigSource(),
      audit,
      configVersion: buildConfigVersionBumper(),
    }),
  });
  const files = buildFileModule({
    clock,
    permission,
    storage: input.storage,
    ...(input.fileOverrides === undefined ? {} : { overrides: input.fileOverrides }),
  });
  return {
    customFieldRouter,
    settingsRouter,
    fileRouter: files.tenantRouter,
    publicFileRouter: files.publicRouter,
  };
}

function buildCommerceTenantRouters(
  input: CoreTenantRouterInput,
): Pick<
  CoreTenantRouters,
  "contactRouter" | "catalogRouter" | "accountingRouter" | "expenseRouter"
> {
  const shared = {
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    permissions: input.permissions,
    idempotency: input.idempotency,
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  };
  return {
    contactRouter: buildContactTenantRouter(shared),
    catalogRouter: buildCatalogTenantRouter(shared),
    accountingRouter: buildAccountingTenantRouter({
      clock: input.clock,
      audit: input.audit,
      permission: input.permission,
    }),
    expenseRouter: buildExpenseTenantRouter({
      clock: input.clock,
      audit: input.audit,
      permission: input.permission,
      idempotency: input.idempotency,
      orgConfig: input.orgConfig,
      manifests: input.manifests,
    }),
  };
}

/** Custom-field, settings, file and commerce routers (cards 2.3–3.8c). */
export function buildCoreTenantRouters(input: CoreTenantRouterInput): CoreTenantRouters {
  return {
    ...buildPlatformCoreRouters(input),
    ...buildCommerceTenantRouters(input),
  };
}

/** Organization owns the Location model. Settings only asks whether the location is ACTIVE. */
function activeLocationExistence(): LocationExistence {
  const locations = buildLocationLookup();
  return {
    exists: (locationId) => locations.isActiveLocation(locationId),
  };
}
