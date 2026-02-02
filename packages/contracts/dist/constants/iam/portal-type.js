// ═══════════════════════════════════════════════════════════════
// Portal Types (User-facing Dashboards)
// ═══════════════════════════════════════════════════════════════
export const PORTAL_TYPE_ENUM = [
    "PLATFORM", // Platform Admin Dashboard
    "ORGANIZATION", // Organization Admin Dashboard
    "CONSUMER", // Consumer/Guardian Portal
];
export const PORTAL_TYPE = PORTAL_TYPE_ENUM.reduce((acc, current) => {
    acc[current] = current;
    return acc;
}, {});
//# sourceMappingURL=portal-type.js.map