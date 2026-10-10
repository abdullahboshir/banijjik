import { defineEnum } from "../define-enum.js";

/**
 * What happened, as `<module>.<entity>.<pastTenseVerb>` (the event-name style of 05-CONVENTIONS).
 * A module card adds the actions of its own use cases here, add-only.
 */
export const AUDIT_ACTION = {
  ORGANIZATION_CREATED: "organization.organization.created",
  ROLE_CREATED: "iam.role.created",
  ROLE_UPDATED: "iam.role.updated",
  ROLE_ARCHIVED: "iam.role.archived",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

/** The kind of record an audit entry is about. Add-only. */
export const AUDIT_ENTITY_TYPE = defineEnum(["organization", "location", "member", "role"]);
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPE)[keyof typeof AUDIT_ENTITY_TYPE];
