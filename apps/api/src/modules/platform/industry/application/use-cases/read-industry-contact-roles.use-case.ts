import { DomainRuleError, ERROR_CODE, type ContactRole } from "@banijjik/contracts";
import type { IndustryTemplateRepository } from "../ports/industry-template-repository.js";
import type { OrganizationTemplateLookup } from "./read-industry-custom-fields.use-case.js";

export interface IndustryContactRoleReader {
  forOrganization(organizationId: string): Promise<readonly ContactRole[]>;
}

/** The contact roles the organization's template allows (`contactRoleKeys`, ADR-113). */
export class ReadIndustryContactRolesUseCase implements IndustryContactRoleReader {
  constructor(
    private readonly templates: IndustryTemplateRepository,
    private readonly organizations: OrganizationTemplateLookup,
  ) {}

  async forOrganization(organizationId: string): Promise<readonly ContactRole[]> {
    const templateKey = await this.organizations.findTemplateKey(organizationId);
    if (templateKey === undefined) throw missingTemplate();
    const template = await this.templates.findByKey(templateKey);
    if (template === undefined) throw missingTemplate();
    return template.configuration.contactRoleKeys;
  }
}

function missingTemplate(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.industry_template_missing",
  });
}
