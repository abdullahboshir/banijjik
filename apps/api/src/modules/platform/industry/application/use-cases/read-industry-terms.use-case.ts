import {
  DomainRuleError,
  ERROR_CODE,
  type IndustryTemplateKey,
  type LocalizedText,
} from "@banijjik/contracts";

interface TemplateTermsSource {
  findByKey(templateKey: IndustryTemplateKey): Promise<
    | {
        readonly configuration: { readonly terms: Readonly<Record<string, LocalizedText>> };
      }
    | undefined
  >;
}

interface OrganizationTemplateKey {
  find(
    organizationId: string,
  ): Promise<{ readonly industryTemplateKey: IndustryTemplateKey } | undefined>;
}

/**
 * Template terms. `read` takes the key the resolver already has. `forOrganization` is the settings
 * API path and stays in this module so only industry names the template key (ADR-104).
 */
export class ReadIndustryTermsUseCase {
  constructor(
    private readonly templates: TemplateTermsSource,
    private readonly organizations: OrganizationTemplateKey,
  ) {}

  async read(templateKey: IndustryTemplateKey): Promise<Readonly<Record<string, LocalizedText>>> {
    const template = await this.templates.findByKey(templateKey);
    if (template === undefined) throw missingTemplate();
    return template.configuration.terms;
  }

  async forOrganization(organizationId: string): Promise<Readonly<Record<string, LocalizedText>>> {
    const organization = await this.organizations.find(organizationId);
    if (organization === undefined) throw missingTemplate();
    return this.read(organization.industryTemplateKey);
  }
}

function missingTemplate(): DomainRuleError {
  return new DomainRuleError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.industry_template_missing",
  });
}
