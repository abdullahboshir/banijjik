import { defineEnum } from "../define-enum.js";

/**
 * What happened, as `<module>.<entity>.<pastTenseVerb>` (the event-name style of 05-CONVENTIONS).
 * A module card adds the actions of its own use cases here, add-only.
 */
export const AUDIT_ACTION = {
  ORGANIZATION_CREATED: "organization.organization.created",
  ORGANIZATION_UPDATED: "organization.organization.updated",
  LOCATION_CREATED: "organization.location.created",
  LOCATION_UPDATED: "organization.location.updated",
  LOCATION_ARCHIVED: "organization.location.archived",
  MEMBER_UPDATED: "organization.member.updated",
  MEMBER_SUSPENDED: "organization.member.suspended",
  MEMBER_REACTIVATED: "organization.member.reactivated",
  MEMBER_REMOVED: "organization.member.removed",
  MEMBER_JOINED: "organization.member.joined",
  INVITATION_CREATED: "organization.invitation.created",
  INVITATION_REVOKED: "organization.invitation.revoked",
  ROLE_CREATED: "iam.role.created",
  ROLE_UPDATED: "iam.role.updated",
  ROLE_ARCHIVED: "iam.role.archived",
  CUSTOM_FIELD_DEFINITION_CREATED: "custom-field.definition.created",
  CUSTOM_FIELD_DEFINITION_UPDATED: "custom-field.definition.updated",
  CUSTOM_FIELD_DEFINITION_ARCHIVED: "custom-field.definition.archived",
  CUSTOM_FIELD_PREFERENCE_UPDATED: "custom-field.preference.updated",
  SETTING_CHANGED: "settings.setting.changed",
  TERM_CHANGED: "settings.term.changed",
  MODULE_TOGGLED: "settings.module.toggled",
  CONTACT_CREATED: "contact.contact.created",
  CONTACT_UPDATED: "contact.contact.updated",
  CONTACT_ARCHIVED: "contact.contact.archived",
  CONTACT_ANONYMIZED: "contact.contact.anonymized",
  OFFERING_CREATED: "catalog.offering.created",
  OFFERING_UPDATED: "catalog.offering.updated",
  OFFERING_PUBLISHED: "catalog.offering.published",
  OFFERING_ARCHIVED: "catalog.offering.archived",
  OFFERING_LOCATION_CHANGED: "catalog.offeringLocation.changed",
  CATEGORY_CREATED: "catalog.category.created",
  CATEGORY_UPDATED: "catalog.category.updated",
  CATEGORY_ARCHIVED: "catalog.category.archived",
  MODIFIER_GROUP_CREATED: "catalog.modifierGroup.created",
  MODIFIER_GROUP_UPDATED: "catalog.modifierGroup.updated",
  MODIFIER_GROUP_ARCHIVED: "catalog.modifierGroup.archived",
  SYNONYMS_UPDATED: "catalog.synonym.updated",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

/** The kind of record an audit entry is about. Add-only. */
export const AUDIT_ENTITY_TYPE = defineEnum([
  "organization",
  "location",
  "member",
  "invitation",
  "role",
  "customFieldDefinition",
  "customFieldPreference",
  "setting",
  "termOverride",
  "moduleOverride",
  "contact",
  "offering",
  "offeringLocation",
  "category",
  "modifierGroup",
  "searchSynonym",
]);
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPE)[keyof typeof AUDIT_ENTITY_TYPE];

/** Recorded in place of a sensitive custom field's value, on both sides: the change stays visible, the data does not (ADR-107). */
export const REDACTED_AUDIT_VALUE = "[redacted]";
