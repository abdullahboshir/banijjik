import type { AuditFields } from "../../../../kernel/audit/index.js";
import type { CustomFieldDefinition } from "../domain/custom-field-definition.entity.js";
import type { CustomFieldPreference } from "../domain/custom-field-preference.entity.js";

export function definitionAuditFields(definition: CustomFieldDefinition): AuditFields {
  return {
    fieldKey: definition.fieldKey,
    labelBn: definition.label.bn,
    labelEn: definition.label.en,
    isRequired: definition.isRequired,
    sortOrder: definition.sortOrder,
    status: definition.status,
    ...(definition.options === undefined ? {} : { options: [...definition.options] }),
    ...(definition.appliesToContactRoles === undefined
      ? {}
      : { appliesToContactRoles: [...definition.appliesToContactRoles] }),
  };
}

export function preferenceAuditFields(preference: CustomFieldPreference): AuditFields {
  return {
    fieldKey: preference.fieldKey,
    isHidden: preference.isHidden,
    ...(preference.label === undefined
      ? {}
      : { labelBn: preference.label.bn, labelEn: preference.label.en }),
    ...(preference.sortOrder === undefined ? {} : { sortOrder: preference.sortOrder }),
  };
}
