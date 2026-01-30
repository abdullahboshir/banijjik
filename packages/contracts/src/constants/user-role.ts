export const USER_ROLE_ENUM = [
  "SUPER_ADMIN",
  "PLATFORM_ADMIN",
  "PLATFORM_SUPPORT",
  "PLATFORM_ACCOUNTING",
  "ORGANIZATION_OWNER",
  "ADMIN",
  "MANAGER",
  "STAFF",
  "MEMBER",
  "CUSTOMER",
  "VIEWER",
] as const;

export type UserRoleType = (typeof USER_ROLE_ENUM)[number];

export const USER_ROLE = USER_ROLE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in UserRoleType]: K },
);
