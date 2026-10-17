import type { ModuleManifest } from "@banijjik/contracts";
import type { StorageConfig } from "../config/index.js";
import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
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
import { MODULE_MANIFESTS } from "./module-registry.js";

export interface CoreTenantRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
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
}

/** Custom-field, settings and file routers (cards 2.3, 2.4 and 3.0). The file module also builds the public router. */
export function buildCoreTenantRouters(input: CoreTenantRouterInput): CoreTenantRouters {
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

/** Organization owns the Location model. Settings only asks whether the location is ACTIVE. */
function activeLocationExistence(): LocationExistence {
  const locations = buildLocationLookup();
  return {
    exists: (locationId) => locations.isActiveLocation(locationId),
  };
}
