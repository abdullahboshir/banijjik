/** Events of the organization module (`<module>.<entity>.<pastTenseVerb>`). Emitted since card 1.5b. */
export const ORGANIZATION_EVENT_TYPE = Object.freeze({
  ORGANIZATION_CREATED: "organization.organization.created",
  LOCATION_CREATED: "organization.location.created",
  MEMBER_JOINED: "organization.member.joined",
  ORGANIZATION_RENAMED: "organization.organization.renamed",
  LOCATION_UPDATED: "organization.location.updated",
  LOCATION_ARCHIVED: "organization.location.archived",
  MEMBER_INVITED: "organization.member.invited",
  MEMBER_ASSIGNMENTS_CHANGED: "organization.member.assignmentsChanged",
  MEMBER_SUSPENDED: "organization.member.suspended",
  MEMBER_REACTIVATED: "organization.member.reactivated",
  MEMBER_REMOVED: "organization.member.removed",
  INVITATION_REVOKED: "organization.invitation.revoked",
  ORGANIZATION_SUSPENDED: "organization.organization.suspended",
  ORGANIZATION_REACTIVATED: "organization.organization.reactivated",
} as const);

export type OrganizationEventType =
  (typeof ORGANIZATION_EVENT_TYPE)[keyof typeof ORGANIZATION_EVENT_TYPE];
