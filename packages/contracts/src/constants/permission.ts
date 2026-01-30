export const PERMISSION_RESOURCE_ENUM = [
  // Core Resources
  "AUTH",
  "USER",
  "ROLE",
  "PERMISSION",
  "ORGANIZATION",
  "PEOPLE",

  // Infrastructure & Settings
  "PLATFORM_SETTINGS",
  "SYSTEM_SETTINGS",
  "ORGANIZATION_SETTINGS",

  // Financial Domains
  "BILLING",
  "INVOICE",
  "PAYMENT",
  "SUBSCRIPTION",
  "PLAN",

  // Operational Capabilities (Cross-Industry)
  "ACADEMIC",
  "APPOINTMENT",
  "INVENTORY",
  "ACCOMMODATION",
  "ORDERING",
] as const;

export type ResourceType = (typeof PERMISSION_RESOURCE_ENUM)[number];

export const RESOURCE_TYPE = PERMISSION_RESOURCE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in ResourceType]: K },
);

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

// Permission Scope
export const PERMISSION_SCOPE_ENUM = [
  "PLATFORM",
  "ORGANIZATION",
  "SELF",
] as const;

export type PermissionScopeType = (typeof PERMISSION_SCOPE_ENUM)[number];

export const PERMISSION_SCOPE = PERMISSION_SCOPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current as PermissionScopeType] = current;
    return acc;
  },
  {} as { [K in PermissionScopeType]: K },
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

// Permission Resolve Strategy
export const PERMISSION_RESOLVE_STRATEGY_ENUM = [
  "FIRST_MATCH",
  "MOST_SPECIFIC",
  "PRIORITY_BASED",
  "CUMULATIVE",
] as const;

type PermissionResolveStrategyType =
  (typeof PERMISSION_RESOLVE_STRATEGY_ENUM)[number];

export const PERMISSION_RESOLVE_STRATEGY =
  PERMISSION_RESOLVE_STRATEGY_ENUM.reduce(
    (acc: any, current) => {
      acc[current as PermissionResolveStrategyType] = current;
      return acc;
    },
    {} as { [K in PermissionResolveStrategyType]: K },
  );

// Permission Condition Operator
export const PERMISSION_CONDITION_OPERATOR_ENUM = [
  "EQ",
  "NEQ",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "IN",
  "NOT_IN",
  "CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "BETWEEN",
  "REGEX",
  "LIKE",
] as const;

type PermissionConditionOperatorType =
  (typeof PERMISSION_CONDITION_OPERATOR_ENUM)[number];

export const PERMISSION_CONDITION_OPERATOR =
  PERMISSION_CONDITION_OPERATOR_ENUM.reduce(
    (acc: any, current) => {
      acc[current as PermissionConditionOperatorType] = current;
      return acc;
    },
    {} as { [K in PermissionConditionOperatorType]: K },
  );

// Permission Effect
export const PERMISSION_EFFECT_ENUM = ["ALLOW", "DENY"] as const;
export type PermissionEffectType = (typeof PERMISSION_EFFECT_ENUM)[number];

export const PERMISSION_EFFECT = PERMISSION_EFFECT_ENUM.reduce(
  (acc: any, current) => {
    acc[current as PermissionEffectType] = current;
    return acc;
  },
  {} as { [K in PermissionEffectType]: K },
);
