// Permission Scope
export const PERMISSION_SCOPE_ENUM = [
    "GLOBAL",
    "PLATFORM",
    "ORGANIZATION",
    "SELF",
];
export const PERMISSION_SCOPE = PERMISSION_SCOPE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=permission-access-scope.js.map