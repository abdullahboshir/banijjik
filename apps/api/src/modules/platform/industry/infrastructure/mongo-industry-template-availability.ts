import { INDUSTRY_TEMPLATE_STATUS, type IndustryTemplateKey } from "@banijjik/contracts";
import type { IndustryTemplateAvailability } from "../../../core/organization/index.js";
import type { IndustryTemplateRepository } from "../application/ports/industry-template-repository.js";

/** Signup may choose a PUBLISHED template only (ADR-075). Unknown, DRAFT and RETIRED are not selectable. */
export class MongoIndustryTemplateAvailability implements IndustryTemplateAvailability {
  constructor(private readonly templates: IndustryTemplateRepository) {}

  async isSelectableAtSignup(templateKey: IndustryTemplateKey): Promise<boolean> {
    const template = await this.templates.findByKey(templateKey);
    return template !== undefined && template.status === INDUSTRY_TEMPLATE_STATUS.PUBLISHED;
  }
}
