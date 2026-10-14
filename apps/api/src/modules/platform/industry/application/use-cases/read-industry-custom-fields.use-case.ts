import {
  DomainRuleError,
  ERROR_CODE,
  type IndustryTemplateCustomField,
  type IndustryTemplateKey,
} from "@banijjik/contracts";
import type { IndustryTemplateRepository } from "../ports/industry-template-repository.js";

/** The organization's template key, resolved outside this use case so this file never names the column. */
export interface OrganizationTemplateLookup {
  findTemplateKey(organizationId: string): Promise<IndustryTemplateKey | undefined>;
}

export interface IndustryCustomFieldReader {
  forOrganization(organizationId: string): Promise<readonly IndustryTemplateCustomField[]>;
}

/**
 * Industry fields stay on the template. Organizations read them; they do not copy them (ADR-076, ADR-102).
 */
export class ReadIndustryCustomFieldsUseCase implements IndustryCustomFieldReader {
  constructor(
    private readonly templates: IndustryTemplateRepository,
    private readonly organizations: OrganizationTemplateLookup,
  ) {}

  async forOrganization(organizationId: string): Promise<readonly IndustryTemplateCustomField[]> {
    const templateKey = await this.organizations.findTemplateKey(organizationId);
    if (templateKey === undefined) throw missingTemplate();
    const template = await this.templates.findByKey(templateKey);
    if (template === undefined) throw missingTemplate();
    return template.configuration.customFields;
  }
}

function missingTemplate(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.industry_template_missing",
  });
}
