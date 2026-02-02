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

export type PermissionResourceType = (typeof PERMISSION_RESOURCE_ENUM)[number];

export const PERMISSION_RESOURCE = PERMISSION_RESOURCE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in PermissionResourceType]: K },
);
