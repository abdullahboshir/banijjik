import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import {
  CustomFieldPreference,
  type CustomFieldPreferenceId,
} from "../domain/custom-field-preference.entity.js";
import type { CustomFieldPreferenceDocument } from "./custom-field-preference.schema.js";

function withoutEmpty<Value>(value: Value | null | undefined): Value | undefined {
  if (value === null || value === undefined) return undefined;
  return value;
}

export function toCustomFieldPreferenceDocument(
  preference: CustomFieldPreference,
): CustomFieldPreferenceDocument {
  return {
    customFieldPreferenceId: preference.customFieldPreferenceId,
    organizationId: preference.organizationId,
    entityType: preference.entityType,
    offeringKind: preference.offeringKind ?? null,
    fieldKey: preference.fieldKey,
    isHidden: preference.isHidden,
    version: preference.version,
    createdAt: preference.createdAt,
    updatedAt: preference.updatedAt,
    createdByUserId: preference.createdByUserId,
    updatedByUserId: preference.updatedByUserId,
    ...(preference.label === undefined ? {} : { label: preference.label }),
    ...(preference.sortOrder === undefined ? {} : { sortOrder: preference.sortOrder }),
  };
}

export function toCustomFieldPreference(
  document: CustomFieldPreferenceDocument,
): CustomFieldPreference {
  const stored = stripMongoInternals(document);
  return CustomFieldPreference.restore({
    customFieldPreferenceId: asId<CustomFieldPreferenceId>(stored.customFieldPreferenceId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    entityType: stored.entityType,
    offeringKind: withoutEmpty(stored.offeringKind),
    fieldKey: stored.fieldKey,
    isHidden: stored.isHidden,
    label: withoutEmpty(stored.label),
    sortOrder: withoutEmpty(stored.sortOrder),
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: asId<UserId>(stored.createdByUserId),
    updatedByUserId: asId<UserId>(stored.updatedByUserId),
  });
}
