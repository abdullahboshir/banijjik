import type { ModuleManifest } from "@banijjik/contracts";
import type { Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { ModuleRegistry } from "../kernel/modules/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildCustomFieldModule } from "../modules/core/custom-field/index.js";
import { buildConfigVersionBumper } from "../modules/core/organization/index.js";
import { buildSettingsTenantRouter } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import { MODULE_MANIFESTS } from "./module-registry.js";

export interface CoreTenantRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly orgConfig: OrgConfigService;
  readonly registry: ModuleRegistry;
  readonly manifests: readonly ModuleManifest[];
}

export interface CoreTenantRouters {
  readonly customFieldRouter: Router;
  readonly settingsRouter: Router;
}

/** Custom-field and settings routers, both mounted on the tenant pipeline (cards 2.3 and 2.4). */
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
  });
  return { customFieldRouter, settingsRouter };
}
