// ═══════════════════════════════════════════════════════════════
// Portal Types (User-facing Dashboards)
// ═══════════════════════════════════════════════════════════════

export const PORTAL_TYPE_ENUM = [
  "PLATFORM", // Platform Admin Dashboard
  "ORGANIZATION", // Organization Admin Dashboard
  "CONSUMER", // Consumer/Guardian Portal
] as const;

export type PortalType = (typeof PORTAL_TYPE_ENUM)[number];

export const PORTAL_TYPE = PORTAL_TYPE_ENUM.reduce(
  (acc: any, current) => {
    acc[current] = current;
    return acc;
  },
  {} as { [K in PortalType]: K },
);
