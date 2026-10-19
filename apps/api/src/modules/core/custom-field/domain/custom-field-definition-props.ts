import type {
  CustomFieldDefinitionChanges,
  CustomFieldDefinitionProps,
  CustomFieldDefinition,
} from "./custom-field-definition.entity.js";

function clearable<Value>(
  current: Value | undefined,
  change: Value | null | undefined,
): Value | undefined {
  if (change === undefined) return current;
  return change ?? undefined;
}

/** Listing-only properties from a patch (ADR-127). */
export function listingFieldsFromChanges(
  definition: CustomFieldDefinition,
  changes: CustomFieldDefinitionChanges,
): Pick<
  CustomFieldDefinitionProps,
  "listingTier" | "isFilterable" | "sectionKey" | "minAgeYears" | "mustDifferFromAccountPhone"
> {
  return {
    listingTier: changes.listingTier ?? definition.listingTier,
    isFilterable: changes.isFilterable ?? definition.isFilterable,
    sectionKey: clearable(definition.sectionKey, changes.sectionKey),
    minAgeYears: clearable(definition.minAgeYears, changes.minAgeYears),
    mustDifferFromAccountPhone:
      changes.mustDifferFromAccountPhone ?? definition.mustDifferFromAccountPhone,
  };
}

export function definitionSnapshot(definition: CustomFieldDefinition): CustomFieldDefinitionProps {
  return {
    customFieldDefinitionId: definition.customFieldDefinitionId,
    organizationId: definition.organizationId,
    entityType: definition.entityType,
    offeringKind: definition.offeringKind,
    fieldKey: definition.fieldKey,
    label: definition.label,
    fieldType: definition.fieldType,
    isRequired: definition.isRequired,
    options: definition.options,
    optionLabels: definition.optionLabels,
    validation: definition.validation,
    referenceEntity: definition.referenceEntity,
    appliesToContactRoles: definition.appliesToContactRoles,
    listingTier: definition.listingTier,
    isFilterable: definition.isFilterable,
    sectionKey: definition.sectionKey,
    minAgeYears: definition.minAgeYears,
    mustDifferFromAccountPhone: definition.mustDifferFromAccountPhone,
    visibility: definition.visibility,
    botAsk: definition.botAsk,
    isSearchable: definition.isSearchable,
    isSensitive: definition.isSensitive,
    sortOrder: definition.sortOrder,
    status: definition.status,
    version: definition.version,
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
    createdByUserId: definition.createdByUserId,
    updatedByUserId: definition.updatedByUserId,
  };
}
