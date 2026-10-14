import type { IndustryTemplateKey } from "@banijjik/contracts";

/** Matches the settings module's reader. Industry does not import that module (ADR-011a). */
export interface IndustrySettingDefaultsRead {
  readonly templateVersion: number;
  readonly settingsDefaults: Readonly<Record<string, unknown>>;
}

interface OrganizationTemplateKey {
  find(
    organizationId: string,
  ): Promise<{ readonly industryTemplateKey: IndustryTemplateKey } | undefined>;
}

interface TemplateDefaultsSource {
  findByKey(templateKey: IndustryTemplateKey): Promise<
    | {
        readonly version: number;
        readonly configuration: { readonly settingsDefaults: Readonly<Record<string, unknown>> };
      }
    | undefined
  >;
}

/**
 * Reads the stored template's `settingsDefaults` for the organization's template key.
 * Invalid defaults are skipped later by the resolver, not here (ADR-076, ADR-103).
 * The settings module calls this through `index.ts`; it does not import this file.
 */
export class ReadIndustrySettingDefaultsUseCase {
  constructor(
    private readonly organizations: OrganizationTemplateKey,
    private readonly templates: TemplateDefaultsSource,
  ) {}

  async read(organizationId: string): Promise<IndustrySettingDefaultsRead | undefined> {
    const organization = await this.organizations.find(organizationId);
    if (organization === undefined) return undefined;
    const template = await this.templates.findByKey(organization.industryTemplateKey);
    if (template === undefined) return undefined;
    return {
      templateVersion: template.version,
      settingsDefaults: template.configuration.settingsDefaults,
    };
  }
}
