import type { IndustryTemplateCard } from "@banijjik/contracts";
import type { IndustryTemplateRepository } from "../ports/industry-template-repository.js";
import { toIndustryTemplateCard } from "./industry-template-presenter.js";

/** The signup list is bounded: operators publish templates, and the answer never grows without a cap. */
export const PUBLISHED_INDUSTRY_TEMPLATE_LIST_CAP = 100;

export class ListPublishedIndustryTemplatesUseCase {
  constructor(private readonly templates: IndustryTemplateRepository) {}

  async execute(): Promise<readonly IndustryTemplateCard[]> {
    const rows = await this.templates.listPublished(PUBLISHED_INDUSTRY_TEMPLATE_LIST_CAP);
    return rows.map(toIndustryTemplateCard);
  }
}
