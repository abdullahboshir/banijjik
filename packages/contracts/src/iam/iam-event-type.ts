/** Events of the iam module (`<module>.<entity>.<pastTenseVerb>`, 05-CONVENTIONS). Emitted since card 1.5b. */
export const IAM_EVENT_TYPE = Object.freeze({
  USER_REGISTERED: "iam.user.registered",
  ROLE_CREATED: "iam.role.created",
  ROLE_PERMISSIONS_CHANGED: "iam.role.permissionsChanged",
  ROLE_ARCHIVED: "iam.role.archived",
} as const);

export type IamEventType = (typeof IAM_EVENT_TYPE)[keyof typeof IAM_EVENT_TYPE];
