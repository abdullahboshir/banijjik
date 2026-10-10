/** Events of the organization module (`<module>.<entity>.<pastTenseVerb>`). Emitted from card 1.5 on. */
export const ORGANIZATION_EVENT_TYPE = Object.freeze({
  ORGANIZATION_CREATED: "organization.organization.created",
  LOCATION_CREATED: "organization.location.created",
  MEMBER_JOINED: "organization.member.joined",
} as const);

export type OrganizationEventType =
  (typeof ORGANIZATION_EVENT_TYPE)[keyof typeof ORGANIZATION_EVENT_TYPE];
