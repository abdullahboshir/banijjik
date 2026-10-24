import { ENROLLMENT_STATUS, type EnrollmentStatus } from "@banijjik/contracts/enrollment";

export const ENROLLMENT_ACTION_KEY = {
  ACTIVATE: "activate",
  FREEZE: "freeze",
  UNFREEZE: "unfreeze",
  RENEW: "renew",
  CANCEL: "cancel",
} as const;

export type EnrollmentActionKey =
  (typeof ENROLLMENT_ACTION_KEY)[keyof typeof ENROLLMENT_ACTION_KEY];

export interface EnrollmentActionPermissions {
  readonly canUpdate: boolean;
  readonly canRenew: boolean;
  readonly canCancel: boolean;
}

/** The actions each status offers: the same table as the API, which still refuses what is not allowed. */
const ACTIONS_BY_STATUS: Readonly<Record<EnrollmentStatus, readonly EnrollmentActionKey[]>> = {
  [ENROLLMENT_STATUS.PENDING]: ["activate", "cancel"],
  [ENROLLMENT_STATUS.ACTIVE]: ["freeze", "renew", "cancel"],
  [ENROLLMENT_STATUS.FROZEN]: ["unfreeze", "cancel"],
  [ENROLLMENT_STATUS.OVERDUE]: ["activate", "renew", "cancel"],
  [ENROLLMENT_STATUS.EXPIRED]: [],
  [ENROLLMENT_STATUS.COMPLETED]: [],
  [ENROLLMENT_STATUS.CANCELLED]: [],
};

function isPermitted(action: EnrollmentActionKey, permissions: EnrollmentActionPermissions) {
  if (action === ENROLLMENT_ACTION_KEY.CANCEL) return permissions.canCancel;
  if (action === ENROLLMENT_ACTION_KEY.RENEW) return permissions.canRenew;
  return permissions.canUpdate;
}

export function enrollmentActionsFor(input: {
  status: EnrollmentStatus;
  freezeAllowed: boolean;
  permissions: EnrollmentActionPermissions;
}): EnrollmentActionKey[] {
  return ACTIONS_BY_STATUS[input.status].filter((action) => {
    if (action === ENROLLMENT_ACTION_KEY.FREEZE && !input.freezeAllowed) return false;
    return isPermitted(action, input.permissions);
  });
}
