import type {
  EffectiveCustomField,
  IndustryTemplateKey,
  LocalizedText,
  ModuleKey,
} from "@banijjik/contracts";

/** Template terms with tenant overrides applied. The key is positional (ADR-104). */
export interface OrgTermsSource {
  forOrganization(
    organizationId: string,
    templateKey: IndustryTemplateKey,
  ): Promise<Readonly<Record<string, LocalizedText>>>;
}

/** Client-visible organization-level settings of the modules the caller passes in. */
export interface OrgClientSettingsSource {
  resolve(
    organizationId: string,
    effectiveModules: ReadonlySet<ModuleKey>,
  ): Promise<Readonly<Record<string, unknown>>>;
}

/** Effective custom fields of the entity types those modules declare. */
export interface OrgFieldsSource {
  forModules(
    organizationId: string,
    effectiveModules: ReadonlySet<ModuleKey>,
  ): Promise<Readonly<Record<string, readonly EffectiveCustomField[]>>>;
}
