import {
  AUDIT_ACTION,
  AUDIT_ENTITY_TYPE,
  CUSTOM_FIELD_EVENT_TYPE,
  type AuditAction,
  type AuditEntityType,
  type CustomFieldEntityType,
} from "@banijjik/contracts";
import { diffAuditFields, type AuditFields } from "../../../../kernel/audit/index.js";
import type { CustomFieldWriteDependencies } from "./ports/custom-field-write-dependencies.js";

export interface RecordedChange {
  readonly action: AuditAction;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly before: AuditFields;
  readonly after: AuditFields;
  readonly eventEntityType: CustomFieldEntityType;
  readonly fieldKey: string;
  readonly organizationId: string;
}

/** One audit entry, one event and one config bump, inside the caller's transaction (ADR-102). */
export async function recordCustomFieldChange(
  dependencies: CustomFieldWriteDependencies,
  change: RecordedChange,
): Promise<void> {
  await dependencies.audit.record({
    action: change.action,
    entityType: change.entityType,
    entityId: change.entityId,
    changes: diffAuditFields(change.before, change.after),
  });
  await dependencies.events.publish(CUSTOM_FIELD_EVENT_TYPE.DEFINITION_CHANGED, {
    entityType: change.eventEntityType,
    fieldKey: change.fieldKey,
  });
  await dependencies.configVersion.bump(change.organizationId);
}

export const DEFINITION_AUDIT = {
  created: AUDIT_ACTION.CUSTOM_FIELD_DEFINITION_CREATED,
  updated: AUDIT_ACTION.CUSTOM_FIELD_DEFINITION_UPDATED,
  archived: AUDIT_ACTION.CUSTOM_FIELD_DEFINITION_ARCHIVED,
  preference: AUDIT_ACTION.CUSTOM_FIELD_PREFERENCE_UPDATED,
} as const;

export const DEFINITION_ENTITY = AUDIT_ENTITY_TYPE.customFieldDefinition;
export const PREFERENCE_ENTITY = AUDIT_ENTITY_TYPE.customFieldPreference;
