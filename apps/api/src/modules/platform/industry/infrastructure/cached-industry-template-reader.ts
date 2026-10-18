import { ERROR_CODE, type IndustryTemplateKey } from "@banijjik/contracts";
import { InMemoryLruCache } from "../../../../kernel/cache/index.js";
import { AppError } from "../../../../kernel/http/index.js";
import { getLogger } from "../../../../kernel/logger/index.js";
import type { IndustryTemplateReader, IndustryTemplateView } from "../../entitlement/index.js";
import type { IndustryTemplateRepository } from "../application/ports/industry-template-repository.js";

/** An edit bumps `version`, which is part of the config cache key, so tenants see it within this window. */
export const INDUSTRY_TEMPLATE_VIEW_CACHE_TTL_MILLISECONDS = 30 * 1000;

export interface CachedIndustryTemplateReaderDependencies {
  readonly templates: IndustryTemplateRepository;
  readonly cache: InMemoryLruCache<IndustryTemplateView>;
}

/**
 * The real IndustryTemplateReader. It answers for every status: a retired template keeps serving
 * the organizations already on it, and a pilot organization on a DRAFT template works (ADR-075).
 */
export class CachedIndustryTemplateReader implements IndustryTemplateReader {
  constructor(private readonly dependencies: CachedIndustryTemplateReaderDependencies) {}

  async find(templateKey: IndustryTemplateKey): Promise<IndustryTemplateView> {
    const cached = this.dependencies.cache.get(templateKey);
    if (cached !== undefined) return cached;
    const template = await this.dependencies.templates.findByKey(templateKey);
    if (template === undefined) throw missingTemplate(templateKey);
    const view: IndustryTemplateView = {
      allowedModuleKeys: template.allowedModuleKeys,
      enabledKinds: template.enabledKinds,
      contactRoleKeys: template.configuration.contactRoleKeys,
      templateVersion: template.version,
    };
    this.dependencies.cache.set(templateKey, view);
    return view;
  }
}

function missingTemplate(templateKey: IndustryTemplateKey): AppError {
  getLogger().error(
    { event: "industry.template.missing", industryTemplateKey: templateKey },
    "industry template row is missing",
  );
  return new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.industry_template_missing",
  });
}
