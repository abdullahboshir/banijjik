import type { PlatformIndustryTemplateDetail } from "@banijjik/contracts";
import { industryTemplateNotFound } from "../../domain/errors.js";
import type { IndustryTemplateRepository } from "../ports/industry-template-repository.js";
import { toIndustryTemplateDetail } from "./industry-template-presenter.js";

export class GetIndustryTemplateUseCase {
  constructor(private readonly templates: IndustryTemplateRepository) {}

  async execute(industryTemplateId: string): Promise<PlatformIndustryTemplateDetail> {
    const template = await this.templates.findById(industryTemplateId);
    if (template === undefined) throw industryTemplateNotFound();
    return toIndustryTemplateDetail(template);
  }
}
