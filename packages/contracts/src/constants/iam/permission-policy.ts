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
