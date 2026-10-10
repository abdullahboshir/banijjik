import { IAM_EVENT_TYPE } from "../iam/iam-event-type.js";
import { ORGANIZATION_EVENT_TYPE } from "../organization/organization-event-type.js";

/** Every domain event type. A module adds its own constant object here when it starts to emit (card 1.5b). */
export const EVENT_TYPE = Object.freeze({
  ...IAM_EVENT_TYPE,
  ...ORGANIZATION_EVENT_TYPE,
} as const);

export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];
