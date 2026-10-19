import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import {
  CustomFieldDefinition,
  type CustomFieldDefinitionId,
} from "../domain/custom-field-definition.entity.js";
import type { CustomFieldDefinitionDocument } from "./custom-field-definition.schema.js";

function withoutEmpty<Value>(value: Value | null | undefined): Value | undefined {
  if (value === null || value === undefined) return undefined;
  return value;
}

function optionalListingFields(
  definition: CustomFieldDefinition,
): Partial<CustomFieldDefinitionDocument> {
  return {
    ...(definition.listingTier === undefined ? {} : { listingTier: definition.listingTier }),
    ...(definition.isFilterable === undefined ? {} : { isFilterable: definition.isFilterable }),
    ...(definition.sectionKey === undefined ? {} : { sectionKey: definition.sectionKey }),
    ...(definition.minAgeYears === undefined ? {} : { minAgeYears: definition.minAgeYears }),
    ...(definition.mustDifferFromAccountPhone === undefined
      ? {}
      : { mustDifferFromAccountPhone: definition.mustDifferFromAccountPhone }),
  };
}

/** Optional fields that are absent are left out. `offeringKind` is stored as null so the unique index can see it. */
export function toCustomFieldDefinitionDocument(
  definition: CustomFieldDefinition,
): CustomFieldDefinitionDocument {
  return {
    customFieldDefinitionId: definition.customFieldDefinitionId,
    organizationId: definition.organizationId,
    entityType: definition.entityType,
    offeringKind: definition.offeringKind ?? null,
    fieldKey: definition.fieldKey,
    label: definition.label,
    fieldType: definition.fieldType,
    isRequired: definition.isRequired,
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
    ...(definition.options === undefined ? {} : { options: [...definition.options] }),
    ...(definition.optionLabels === undefined ? {} : { optionLabels: definition.optionLabels }),
    ...(definition.validation === undefined ? {} : { validation: definition.validation }),
    ...(definition.referenceEntity === undefined
      ? {}
      : { referenceEntity: definition.referenceEntity }),
    ...(definition.appliesToContactRoles === undefined
      ? {}
      : { appliesToContactRoles: [...definition.appliesToContactRoles] }),
    ...optionalListingFields(definition),
  };
}

export function toCustomFieldDefinition(
  document: CustomFieldDefinitionDocument,
): CustomFieldDefinition {
  const stored = stripMongoInternals(document);
  return CustomFieldDefinition.restore({
    customFieldDefinitionId: asId<CustomFieldDefinitionId>(stored.customFieldDefinitionId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    entityType: stored.entityType,
    offeringKind: withoutEmpty(stored.offeringKind),
    fieldKey: stored.fieldKey,
    label: stored.label,
    fieldType: stored.fieldType,
    isRequired: stored.isRequired,
    options: withoutEmpty(stored.options),
    optionLabels: withoutEmpty(stored.optionLabels),
    validation: withoutEmpty(stored.validation),
    referenceEntity: withoutEmpty(stored.referenceEntity),
    appliesToContactRoles:
      stored.appliesToContactRoles?.length === 0
        ? undefined
        : withoutEmpty(stored.appliesToContactRoles),
    listingTier: withoutEmpty(stored.listingTier),
    isFilterable: withoutEmpty(stored.isFilterable),
    sectionKey: withoutEmpty(stored.sectionKey),
    minAgeYears: withoutEmpty(stored.minAgeYears),
    mustDifferFromAccountPhone: withoutEmpty(stored.mustDifferFromAccountPhone),
    visibility: stored.visibility,
    botAsk: stored.botAsk,
    isSearchable: stored.isSearchable,
    isSensitive: stored.isSensitive,
    sortOrder: stored.sortOrder,
    status: stored.status,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: asId<UserId>(stored.createdByUserId),
    updatedByUserId: asId<UserId>(stored.updatedByUserId),
  });
}
