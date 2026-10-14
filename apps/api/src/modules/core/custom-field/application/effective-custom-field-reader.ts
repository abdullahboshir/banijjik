import type { CustomFieldEntityType, OfferingKind } from "@banijjik/contracts";
import type { OrganizationId } from "@banijjik/ids";
import type { IndustryCustomFields } from "./ports/custom-field-ports.js";
import type { EffectiveCustomFieldReader } from "./ports/custom-field-ports.js";
import type { CustomFieldDefinitionRepository } from "./ports/custom-field-ports.js";
import type { CustomFieldPreferenceRepository } from "./ports/custom-field-preference-repository.js";
import { mergeEffectiveFields } from "./effective-custom-field.js";

export interface EffectiveReaderDependencies {
  readonly definitions: CustomFieldDefinitionRepository;
  readonly preferences: CustomFieldPreferenceRepository;
  readonly industry: IndustryCustomFields;
}

/** The list Phase 3 modules read when they build a form (ADR-102). */
export class EffectiveCustomFieldReaderService implements EffectiveCustomFieldReader {
  constructor(private readonly dependencies: EffectiveReaderDependencies) {}

  async forEntity(
    organizationId: OrganizationId,
    entityType: CustomFieldEntityType,
    offeringKind?: OfferingKind,
  ): Promise<ReturnType<typeof mergeEffectiveFields>> {
    const [industryFields, preferences, definitions] = await Promise.all([
      this.dependencies.industry.forOrganization(organizationId),
      this.dependencies.preferences.listFor(entityType, offeringKind),
      this.dependencies.definitions.listActive(entityType, offeringKind),
    ]);
    return mergeEffectiveFields({
      entityType,
      offeringKind,
      industryFields,
      preferences,
      definitions,
    });
  }
}
