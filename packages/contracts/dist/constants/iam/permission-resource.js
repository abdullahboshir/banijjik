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
];
export const PERMISSION_RESOURCE = PERMISSION_RESOURCE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=permission-resource.js.map