import type { ModuleManifest } from "@banijjik/contracts";
import type { Router } from "express";
import type { OrgConfigReader, PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { ConfigVersionBumper } from "../../../kernel/tenancy/index.js";
import { buildIndustrySettingDefaultsReader } from "../../platform/industry/index.js";
import { settingCatalogOf } from "./application/setting-catalog.js";
import { SettingsResolver } from "./application/settings-resolver.js";
import { GetSettingsUseCase } from "./application/use-cases/get-settings.use-case.js";
import { UpdateSettingsUseCase } from "./application/use-cases/update-settings.use-case.js";
import { MongoLocationExistence } from "./infrastructure/mongo-location-existence.js";
import { MongoSettingValueRepository } from "./infrastructure/mongo-setting-value.repository.js";
import { SettingsController } from "./presentation/settings.controller.js";
import { buildSettingsRouter } from "./presentation/settings.router.js";

export { registerSettingsModels } from "./infrastructure/register-settings-models.js";
export { settingsManifest } from "./module.manifest.js";

export interface SettingsResolverDependencies {
  readonly orgConfig: OrgConfigReader;
  readonly manifests: readonly ModuleManifest[];
}

/** Later cards (2.2) resolve through this. It does not cache; 2.2 adds the configVersion cache. */
export function buildSettingsResolver(
  dependencies: SettingsResolverDependencies,
): SettingsResolver {
  return new SettingsResolver({
    catalog: settingCatalogOf(dependencies.manifests),
    orgConfig: dependencies.orgConfig,
    values: new MongoSettingValueRepository(),
    defaults: buildIndustrySettingDefaultsReader(),
  });
}

export interface SettingsTenantRouterDependencies {
  readonly permission: PermissionMiddlewareFactory;
  readonly audit: AuditRecorder;
  readonly orgConfig: OrgConfigReader;
  readonly configVersion: ConfigVersionBumper;
  readonly manifests: readonly ModuleManifest[];
}

/** `GET` and `PATCH /orgs/{organizationId}/settings`, mounted by routes/v1.ts. */
export function buildSettingsTenantRouter(dependencies: SettingsTenantRouterDependencies): Router {
  const catalog = settingCatalogOf(dependencies.manifests);
  const values = new MongoSettingValueRepository();
  const resolver = buildSettingsResolver(dependencies);
  const controller = new SettingsController({
    getSettings: new GetSettingsUseCase(resolver),
    updateSettings: new UpdateSettingsUseCase({
      catalog,
      orgConfig: dependencies.orgConfig,
      locations: new MongoLocationExistence(),
      values,
      resolver,
      unitOfWork: new MongoUnitOfWork(),
      audit: dependencies.audit,
      events: kernelEventPublisher,
      configVersion: dependencies.configVersion,
    }),
  });
  return buildSettingsRouter(controller, dependencies.permission);
}
