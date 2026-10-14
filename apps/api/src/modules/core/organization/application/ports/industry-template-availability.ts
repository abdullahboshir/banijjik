import type { IndustryTemplateKey } from "@banijjik/contracts";

/**
 * Whether a template may be chosen when creating an organization.
 * Implemented by platform/industry and adapted in routes/v1.ts.
 */
export interface IndustryTemplateAvailability {
  isSelectableAtSignup(templateKey: IndustryTemplateKey): Promise<boolean>;
}
