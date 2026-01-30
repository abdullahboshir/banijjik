// Permission Scope
export const PERMISSION_SCOPE_ENUM = [
  "GLOBAL",
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
