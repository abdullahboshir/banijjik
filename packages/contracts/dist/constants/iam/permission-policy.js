// Permission Resolve Strategy
export const PERMISSION_RESOLVE_STRATEGY_ENUM = [
    "FIRST_MATCH",
    "MOST_SPECIFIC",
    "PRIORITY_BASED",
    "CUMULATIVE",
];
export const PERMISSION_RESOLVE_STRATEGY = PERMISSION_RESOLVE_STRATEGY_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
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
];
export const PERMISSION_CONDITION_OPERATOR = PERMISSION_CONDITION_OPERATOR_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=permission-policy.js.map