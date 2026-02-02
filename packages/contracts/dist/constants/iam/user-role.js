export const USER_ROLE_ENUM = [
    "SUPER_ADMIN",
    "PLATFORM_ADMIN",
    "PLATFORM_SUPPORT",
    "PLATFORM_ACCOUNTING",
    "ORGANIZATION_OWNER",
    "ADMIN",
    "MANAGER",
    "STAFF",
    "CONSUMER",
    "VIEWER",
];
export const USER_ROLE = USER_ROLE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=user-role.js.map