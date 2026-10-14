import type { Router } from "express";
import type { IndustryTemplateReader } from "../entitlement/index.js";
import {
  buildOrganizationConfigSource,
  type IndustryTemplateAvailability,
} from "../../core/organization/index.js";
import type { PlatformPermissionMiddlewareFactory } from "../../../kernel/auth/index.js";
import { InMemoryLruCache } from "../../../kernel/cache/index.js";
import type { Clock } from "../../../kernel/time/index.js";
import { EnsureSeedIndustryTemplatesUseCase } from "./application/use-cases/ensure-seed-industry-templates.use-case.js";
import { GetIndustryTemplateUseCase } from "./application/use-cases/get-industry-template.use-case.js";
import {
  ReadIndustryCustomFieldsUseCase,
  type IndustryCustomFieldReader,
} from "./application/use-cases/read-industry-custom-fields.use-case.js";
import { ListPlatformIndustryTemplatesUseCase } from "./application/use-cases/list-platform-industry-templates.use-case.js";
import { ListPublishedIndustryTemplatesUseCase } from "./application/use-cases/list-published-industry-templates.use-case.js";
import {
  CachedIndustryTemplateReader,
  INDUSTRY_TEMPLATE_VIEW_CACHE_TTL_MILLISECONDS,
} from "./infrastructure/cached-industry-template-reader.js";
import { loadSeedIndustryTemplates } from "./infrastructure/load-seed-templates.js";
import { MongoIndustryTemplateAvailability } from "./infrastructure/mongo-industry-template-availability.js";
import { MongoIndustryTemplateRepository } from "./infrastructure/mongo-industry-template.repository.js";
import { PlatformIndustryTemplateController } from "./presentation/platform-industry-template.controller.js";
import { buildPlatformIndustryTemplateRouter } from "./presentation/platform-industry-template.router.js";
import { PublishedIndustryTemplateController } from "./presentation/published-industry-template.controller.js";
import { buildPublishedIndustryTemplateRouter as createPublishedIndustryTemplateRouter } from "./presentation/published-industry-template.router.js";

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
}

/** `/platform/industry-templates`, mounted behind authenticatePlatform. */
export function buildIndustryPlatformRouter(
  dependencies: IndustryPlatformRouterDependencies,
): Router {
  const templates = new MongoIndustryTemplateRepository();
  const controller = new PlatformIndustryTemplateController({
    listTemplates: new ListPlatformIndustryTemplatesUseCase(templates),
    getTemplate: new GetIndustryTemplateUseCase(templates),
  });
  return buildPlatformIndustryTemplateRouter(controller, dependencies.permission);
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
