import type { Router } from "express";
import type { IndustryTemplateReader } from "../entitlement/index.js";
import {
  buildOrganizationConfigSource,
  type ChangeIndustryTemplateUseCase,
  type IndustryTemplateAvailability,
} from "../../core/organization/index.js";
import type { PlatformAuditRecorder } from "../../../kernel/audit/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import { InMemoryLruCache } from "../../../kernel/cache/index.js";
import { MongoUnitOfWork } from "../../../kernel/db/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { AssessIndustryTemplateMove } from "./application/assess-industry-template-move.js";
import { CreateIndustryTemplateUseCase } from "./application/use-cases/create-industry-template.use-case.js";
import { EnsureSeedIndustryTemplatesUseCase } from "./application/use-cases/ensure-seed-industry-templates.use-case.js";
import { GetIndustryTemplateUseCase } from "./application/use-cases/get-industry-template.use-case.js";
import {
  ReadIndustryCustomFieldsUseCase,
  type IndustryCustomFieldReader,
} from "./application/use-cases/read-industry-custom-fields.use-case.js";
import { ReadIndustrySettingDefaultsUseCase } from "./application/use-cases/read-industry-setting-defaults.use-case.js";
import { ReadIndustryTermsUseCase } from "./application/use-cases/read-industry-terms.use-case.js";
import { ListPlatformIndustryTemplatesUseCase } from "./application/use-cases/list-platform-industry-templates.use-case.js";
import { ListPublishedIndustryTemplatesUseCase } from "./application/use-cases/list-published-industry-templates.use-case.js";
import { SetIndustryTemplateStatusUseCase } from "./application/use-cases/set-industry-template-status.use-case.js";
import { UpdateIndustryTemplateUseCase } from "./application/use-cases/update-industry-template.use-case.js";
import type { OrganizationTemplateUsage } from "./application/use-cases/industry-template-write-dependencies.js";
import {
  CachedIndustryTemplateReader,
  INDUSTRY_TEMPLATE_VIEW_CACHE_TTL_MILLISECONDS,
} from "./infrastructure/cached-industry-template-reader.js";
import { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";
import { MongoIndustryTemplateAvailability } from "./infrastructure/mongo-industry-template-availability.js";
import { MongoIndustryTemplateRepository } from "./infrastructure/mongo-industry-template.repository.js";
import { ChangeIndustryTemplateController } from "./presentation/change-industry-template.controller.js";
import { buildChangeIndustryTemplateRoutes } from "./presentation/change-industry-template.router.js";
import { PlatformIndustryTemplateController } from "./presentation/platform-industry-template.controller.js";
import { buildPlatformIndustryTemplateRouter } from "./presentation/platform-industry-template.router.js";
import type { SettingCatalog } from "./application/registered-settings.js";
import { PublishedIndustryTemplateController } from "./presentation/published-industry-template.controller.js";
import { buildPublishedIndustryTemplateRouter as createPublishedIndustryTemplateRouter } from "./presentation/published-industry-template.router.js";
import { SettingDefinitionsController } from "./presentation/setting-definitions.controller.js";
import { buildSettingDefinitionsRouter as createSettingDefinitionsRouter } from "./presentation/setting-definitions.router.js";

export { registerIndustryModels } from "./infrastructure/register-industry-models.js";
export { industryManifest } from "./module.manifest.js";
export { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";
export type { EnsureSeedIndustryTemplatesUseCase } from "./application/use-cases/ensure-seed-industry-templates.use-case.js";

/** The template reader for the resolver. Views are cached for 30 seconds per key. */
export function buildIndustryTemplateReader(clock: Clock): IndustryTemplateReader {
  return new CachedIndustryTemplateReader({
    templates: new MongoIndustryTemplateRepository(),
    cache: new InMemoryLruCache({
      clock,
      ttlMilliseconds: INDUSTRY_TEMPLATE_VIEW_CACHE_TTL_MILLISECONDS,
    }),
  });
}

/** Template terms for a key the resolver already holds. Uncached (ADR-104). */
export function buildIndustryTermsReader(): ReadIndustryTermsUseCase {
  return new ReadIndustryTermsUseCase(
    new MongoIndustryTemplateRepository(),
    buildOrganizationConfigSource(),
  );
}

/** The stored template defaults for the settings resolver. Uncached, so a test edit is visible (ADR-103). */
export function buildIndustrySettingDefaultsReader(): ReadIndustrySettingDefaultsUseCase {
  return new ReadIndustrySettingDefaultsUseCase(
    buildOrganizationConfigSource(),
    new MongoIndustryTemplateRepository(),
  );
}

/** Signup accepts only a PUBLISHED template. */
export function buildIndustryTemplateAvailability(): IndustryTemplateAvailability {
  return new MongoIndustryTemplateAvailability(new MongoIndustryTemplateRepository());
}

export function buildEnsureSeedIndustryTemplatesUseCase(
  clock: Clock,
): EnsureSeedIndustryTemplatesUseCase {
  return new EnsureSeedIndustryTemplatesUseCase({
    templates: new MongoIndustryTemplateRepository(),
    seed: loadSeedIndustryTemplates(),
    clock,
  });
}

/** `GET /industry-templates`, for any signed-in admin-audience user. */
export function buildPublishedIndustryTemplateRouter(): Router {
  const controller = new PublishedIndustryTemplateController(
    new ListPublishedIndustryTemplatesUseCase(new MongoIndustryTemplateRepository()),
  );
  return createPublishedIndustryTemplateRouter(controller);
}

export interface IndustryPlatformRouterDependencies {
  readonly permission: PlatformPermissionMiddlewareFactory;
  readonly clock: Clock;
  readonly platformAudit: PlatformAuditRecorder;
  readonly usage: OrganizationTemplateUsage;
  readonly settings: SettingCatalog;
}

/** `/platform/industry-templates`, mounted behind authenticatePlatform. */
export function buildIndustryPlatformRouter(
  dependencies: IndustryPlatformRouterDependencies,
): Router {
  const templates = new MongoIndustryTemplateRepository();
  const writes = {
    templates,
    usage: dependencies.usage,
    unitOfWork: new MongoUnitOfWork(),
    platformAudit: dependencies.platformAudit,
    clock: dependencies.clock,
    settings: dependencies.settings,
  };
  const controller = new PlatformIndustryTemplateController({
    listTemplates: new ListPlatformIndustryTemplatesUseCase(templates),
    getTemplate: new GetIndustryTemplateUseCase(templates, dependencies.settings),
    createTemplate: new CreateIndustryTemplateUseCase(writes),
    updateTemplate: new UpdateIndustryTemplateUseCase(writes),
    setStatus: new SetIndustryTemplateStatusUseCase(writes),
  });
  return buildPlatformIndustryTemplateRouter(controller, dependencies.permission);
}

/** The additive check for moving an organization. Comparisons of the key stay in this module. */
export function buildIndustryTemplateMove(): AssessIndustryTemplateMove {
  return new AssessIndustryTemplateMove(new MongoIndustryTemplateRepository());
}

/** `POST /platform/organizations/{organizationId}/change-industry-template`. */
export function buildChangeIndustryTemplateRouter(
  changeTemplate: ChangeIndustryTemplateUseCase,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  return buildChangeIndustryTemplateRoutes(
    new ChangeIndustryTemplateController(changeTemplate),
    permission,
  );
}

export { settingCatalogFrom } from "./application/registered-settings.js";

/** `GET /platform/setting-definitions` (`platform.industry.read`). */
export function buildSettingDefinitionsRouter(
  settings: SettingCatalog,
  permission: PlatformPermissionMiddlewareFactory,
): Router {
  return createSettingDefinitionsRouter(new SettingDefinitionsController(settings), permission);
}

export type { IndustryCustomFieldReader };

/** Industry custom fields of the active organization's template (ADR-102). */
export function buildIndustryCustomFieldReader(): IndustryCustomFieldReader {
  const organizations = buildOrganizationConfigSource();
  return new ReadIndustryCustomFieldsUseCase(new MongoIndustryTemplateRepository(), {
    findTemplateKey: async (organizationId) => {
      const snapshot = await organizations.find(organizationId);
      return snapshot?.industryTemplateKey;
    },
  });
}
