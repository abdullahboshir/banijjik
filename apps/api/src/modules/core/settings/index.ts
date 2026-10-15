import type { IndustryTemplateKey, ModuleKey, ModuleManifest } from "@banijjik/contracts";
import type { Router } from "express";
import type { OrgConfigReader, PermissionMiddlewareFactory } from "../../../kernel/access/index.js";
import type { AuditRecorder } from "../../../kernel/audit/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import { kernelEventPublisher } from "../../../kernel/events/index.js";
import type { ConfigVersionBumper } from "../../../kernel/tenancy/index.js";
import {
  buildIndustrySettingDefaultsReader,
  buildIndustryTermsReader,
} from "../../platform/industry/index.js";
import { mergeTermTexts } from "./application/merge-terms.js";
import { settingCatalogOf } from "./application/setting-catalog.js";
import { SettingsResolver } from "./application/settings-resolver.js";
import { GetSettingsUseCase } from "./application/use-cases/get-settings.use-case.js";
import { GetTermsUseCase } from "./application/use-cases/get-terms.use-case.js";
import { UpdateSettingsUseCase } from "./application/use-cases/update-settings.use-case.js";
import { UpdateTermsUseCase } from "./application/use-cases/update-terms.use-case.js";
import type { LocationExistence } from "./application/ports/location-existence.js";
import type { TenantModuleSwitch } from "../../platform/entitlement/index.js";
import { MongoSettingValueRepository } from "./infrastructure/mongo-setting-value.repository.js";
import { MongoTermOverrideRepository } from "./infrastructure/mongo-term-override.repository.js";
import { SettingsController } from "./presentation/settings.controller.js";
import { buildSettingsRouter } from "./presentation/settings.router.js";

export { registerSettingsModels } from "./infrastructure/register-settings-models.js";
export { settingsManifest } from "./module.manifest.js";
export type { LocationExistence };

export interface SettingsResolverDependencies {
  readonly orgConfig: OrgConfigReader;
  readonly manifests: readonly ModuleManifest[];
}

/** Resolves settings. The config cache lives in the entitlement resolver (ADR-104). */
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
  readonly locations: LocationExistence;
  readonly modules: TenantModuleSwitch;
}

/** `GET` and `PATCH` for settings, terms and tenant module switches. */
export function buildSettingsTenantRouter(dependencies: SettingsTenantRouterDependencies): Router {
  const catalog = settingCatalogOf(dependencies.manifests);
  const values = new MongoSettingValueRepository();
  const resolver = buildSettingsResolver(dependencies);
  const templateTerms = buildIndustryTermsReader();
  const overrides = new MongoTermOverrideRepository();
  const readTerms = new GetTermsUseCase(templateTerms, overrides);
  const controller = new SettingsController({
    getSettings: new GetSettingsUseCase(resolver),
    updateSettings: new UpdateSettingsUseCase({
      catalog,
      orgConfig: dependencies.orgConfig,
      locations: dependencies.locations,
      values,
      resolver,
      unitOfWork: new MongoUnitOfWork(),
      audit: dependencies.audit,
      events: kernelEventPublisher,
      configVersion: dependencies.configVersion,
    }),
    getTerms: readTerms,
    updateTerms: new UpdateTermsUseCase({
      templateTerms,
      overrides,
      unitOfWork: new MongoUnitOfWork(),
      audit: dependencies.audit,
      events: kernelEventPublisher,
      configVersion: dependencies.configVersion,
      readTerms,
    }),
    modules: dependencies.modules,
  });
  return buildSettingsRouter(controller, dependencies.permission);
}

/**
 * Terms for the resolver. `templateKey` is positional so this file never names the industry key.
 * The throwing reader makes a cycle visible: client-visible settings must not call back.
 */
export function buildResolvedTermTexts(): {
  forOrganization(
    organizationId: string,
    templateKey: IndustryTemplateKey,
  ): Promise<ReturnType<typeof mergeTermTexts>>;
} {
  const reader = buildIndustryTermsReader();
  const overrides = new MongoTermOverrideRepository();
  return {
    async forOrganization(_organizationId, templateKey) {
      const [templateTerms, rows] = await Promise.all([reader.read(templateKey), overrides.list()]);
      return mergeTermTexts(templateTerms, rows);
    },
  };
}

export function buildClientSettingsSource(manifests: readonly ModuleManifest[]): {
  resolve(
    organizationId: string,
    effectiveModules: ReadonlySet<ModuleKey>,
  ): Promise<Record<string, unknown>>;
} {
  const resolver = new SettingsResolver({
    catalog: settingCatalogOf(manifests),
    orgConfig: {
      current: () => Promise.reject(new Error("settings source must not read OrgConfigReader")),
    },
    values: new MongoSettingValueRepository(),
    defaults: buildIndustrySettingDefaultsReader(),
  });
  return {
    resolve: (organizationId, effectiveModules) =>
      resolver.resolveClientVisible(organizationId, effectiveModules),
  };
}
