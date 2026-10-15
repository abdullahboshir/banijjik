import type { PlatformIndustryTemplateDetail } from "@banijjik/contracts";
import { industryTemplateNotFound } from "../../domain/errors.js";
import type { SettingCatalog } from "../registered-settings.js";
import type { IndustryTemplateRepository } from "../ports/industry-template-repository.js";
import { toIndustryTemplateDetail } from "./industry-template-presenter.js";

export class GetIndustryTemplateUseCase {
  constructor(
    private readonly templates: IndustryTemplateRepository,
    private readonly settings: SettingCatalog,
  ) {}

  async execute(industryTemplateId: string): Promise<PlatformIndustryTemplateDetail> {
    const template = await this.templates.findById(industryTemplateId);
    if (template === undefined) throw industryTemplateNotFound();
    return toIndustryTemplateDetail(template, this.settings);
  }
}
