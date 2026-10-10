/** Events of the iam module (`<module>.<entity>.<pastTenseVerb>`, 05-CONVENTIONS). Emitted from card 1.5 on. */
export const IAM_EVENT_TYPE = Object.freeze({
  USER_REGISTERED: "iam.user.registered",
} as const);

export type IamEventType = (typeof IAM_EVENT_TYPE)[keyof typeof IAM_EVENT_TYPE];
