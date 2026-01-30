// Permission Action
export const PERMISSION_ACTION_ENUM = [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "MANAGE",
  "VIEW",
  "ASSIGN",
  "PUBLISH",
  "UNPUBLISH",
  "VERIFY",
  "CANCEL",
  "ACTIVATE",
  "DEACTIVATE",
  "REFUND",
  "BLOCK",
  "UNBLOCK",
  "SUSPEND",
  "UNSUSPEND",
  "RESTRICT",
  "UNRESTRICT",
  "EXPORT",
  "IMPORT",
  "ESCALATE",
] as const;

export type PermissionActionType = (typeof PERMISSION_ACTION_ENUM)[number];

export const PERMISSION_ACTION = PERMISSION_ACTION_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in PermissionActionType]: K },
);

// Permission Sensitive Action (Subset of PERMISSION_ACTION)
export const PERMISSION_SENSITIVE_ACTION_ENUM: readonly PermissionActionType[] =
  [
    PERMISSION_ACTION.APPROVE,
    PERMISSION_ACTION.REJECT,
    PERMISSION_ACTION.REFUND,
    PERMISSION_ACTION.BLOCK,
    PERMISSION_ACTION.RESTRICT,
    PERMISSION_ACTION.ESCALATE,
    PERMISSION_ACTION.DELETE,
  ] as const;

export type PermissionSensitiveActionType =
  (typeof PERMISSION_SENSITIVE_ACTION_ENUM)[number];

export const PERMISSION_SENSITIVE_ACTION =
  PERMISSION_SENSITIVE_ACTION_ENUM.reduce(
    (acc: any, current) => {
      acc[current as PermissionSensitiveActionType] = current;
      return acc;
    },
    {} as { [K in PermissionSensitiveActionType]: K },
  );
