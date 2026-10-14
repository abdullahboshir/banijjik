import {
  CUSTOM_FIELD_DEFINITION_STATUS,
  CUSTOM_FIELD_SCOPE,
  type CustomFieldEntityType,
  type EffectiveCustomField,
  type IndustryTemplateCustomField,
  type LocalizedText,
  type OfferingKind,
} from "@banijjik/contracts";
import type { CustomFieldDefinition } from "../domain/custom-field-definition.entity.js";
import type { CustomFieldPreference } from "../domain/custom-field-preference.entity.js";

interface OrderedField {
  readonly sortOrder: number;
  readonly fieldKey: string;
}

function byOrder(left: OrderedField, right: OrderedField): number {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  if (left.fieldKey < right.fieldKey) return -1;
  if (left.fieldKey > right.fieldKey) return 1;
  return 0;
}

function labelOf(fieldKey: string, label: LocalizedText | undefined): LocalizedText {
  return label ?? { bn: fieldKey, en: fieldKey };
}

function preferenceKey(
  entityType: string,
  offeringKind: string | undefined,
  fieldKey: string,
): string {
  return `${entityType}\u0000${offeringKind ?? ""}\u0000${fieldKey}`;
}

function sameOffering(
  field: IndustryTemplateCustomField,
  offeringKind: OfferingKind | undefined,
): boolean {
  return (field.offeringKind ?? undefined) === offeringKind;
}

/** Industry fields of this entity, with preferences applied, then active organization fields (ADR-102). */
export function mergeEffectiveFields(input: {
  readonly entityType: CustomFieldEntityType;
  readonly offeringKind: OfferingKind | undefined;
  readonly industryFields: readonly IndustryTemplateCustomField[];
  readonly preferences: readonly CustomFieldPreference[];
  readonly definitions: readonly CustomFieldDefinition[];
}): EffectiveCustomField[] {
  const preferences = new Map(
    input.preferences.map((preference) => [
      preferenceKey(preference.entityType, preference.offeringKind, preference.fieldKey),
      preference,
    ]),
  );
  const industry = input.industryFields
    .filter(
      (field) => field.entityType === input.entityType && sameOffering(field, input.offeringKind),
    )
    .map((field, index) =>
      toIndustryField({ entityType: input.entityType, field, index, preferences }),
    )
    .filter((field): field is EffectiveCustomField => field !== undefined)
    .sort(byOrder);
  const organization = input.definitions.map(toOrganizationField).sort(byOrder);
  return [...industry, ...organization];
}

function toIndustryField(input: {
  readonly entityType: CustomFieldEntityType;
  readonly field: IndustryTemplateCustomField;
  readonly index: number;
  readonly preferences: ReadonlyMap<string, CustomFieldPreference>;
}): EffectiveCustomField | undefined {
  const { entityType, field, index, preferences } = input;
  const preference = preferences.get(preferenceKey(entityType, field.offeringKind, field.fieldKey));
  if (preference?.isHidden === true) return undefined;
  return {
    scope: CUSTOM_FIELD_SCOPE.INDUSTRY,
    isEditable: false,
    entityType,
    fieldKey: field.fieldKey,
    label: labelOf(field.fieldKey, preference?.label ?? field.label),
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    visibility: field.visibility,
    botAsk: field.botAsk,
    isSearchable: field.isSearchable,
    isSensitive: field.isSensitive,
    sortOrder: preference?.sortOrder ?? index,
    version: preference?.version ?? 0,
    status: CUSTOM_FIELD_DEFINITION_STATUS.ACTIVE,
    ...optionalIndustryParts(field),
  };
}

function optionalIndustryParts(field: IndustryTemplateCustomField): Partial<EffectiveCustomField> {
  return {
    ...(field.offeringKind === undefined ? {} : { offeringKind: field.offeringKind }),
    ...(field.options === undefined ? {} : { options: field.options }),
    ...(field.optionLabels === undefined ? {} : { optionLabels: field.optionLabels }),
    ...(field.referenceEntity === undefined ? {} : { referenceEntity: field.referenceEntity }),
  };
}

export function toOrganizationField(definition: CustomFieldDefinition): EffectiveCustomField {
  return {
    scope: CUSTOM_FIELD_SCOPE.ORGANIZATION,
    isEditable: true,
    entityType: definition.entityType,
    fieldKey: definition.fieldKey,
    label: definition.label,
    fieldType: definition.fieldType,
    isRequired: definition.isRequired,
    visibility: definition.visibility,
    botAsk: definition.botAsk,
    isSearchable: definition.isSearchable,
    isSensitive: definition.isSensitive,
    sortOrder: definition.sortOrder,
    customFieldDefinitionId: definition.customFieldDefinitionId,
    version: definition.version,
    status: definition.status,
    ...optionalDefinitionParts(definition),
  };
}

function optionalDefinitionParts(definition: CustomFieldDefinition): Partial<EffectiveCustomField> {
  return {
    ...(definition.offeringKind === undefined ? {} : { offeringKind: definition.offeringKind }),
    ...(definition.options === undefined ? {} : { options: definition.options }),
    ...(definition.optionLabels === undefined ? {} : { optionLabels: definition.optionLabels }),
    ...(definition.validation === undefined ? {} : { validation: definition.validation }),
    ...(definition.referenceEntity === undefined
      ? {}
      : { referenceEntity: definition.referenceEntity }),
  };
}
