// ═══════════════════════════════════════════════════════════════
// Permission Domain (Bounded Context for Sidebar Grouping)
// ═══════════════════════════════════════════════════════════════
export const PERMISSION_DOMAIN_ENUM = [
    // Core Domains
    "IAM",
    "ORGANIZATION",
    "PLATFORM",
    // Financial
    "BILLING",
    // Operations
    "INVENTORY",
    "ORDERING",
    // Capabilities
    "ACCOMMODATION",
    "APPOINTMENT",
    "ACADEMIC",
    // System
    "SYSTEM",
];
export const PERMISSION_DOMAIN = PERMISSION_DOMAIN_ENUM.reduce((acc, current) => {
    acc[current.toUpperCase()] = current;
    return acc;
}, {});
// ═══════════════════════════════════════════════════════════════
// Resource to Domain Mapping (EXHAUSTIVE - TypeScript will error if missing)
// ═══════════════════════════════════════════════════════════════
export const RESOURCE_DOMAIN_MAP = {
    // IAM
    AUTH: "IAM",
    USER: "IAM",
    ROLE: "IAM",
    PERMISSION: "IAM",
    // Organization
    ORGANIZATION: "ORGANIZATION",
    ORGANIZATION_SETTINGS: "ORGANIZATION",
    PEOPLE: "ORGANIZATION",
    // Platform
    PLATFORM_SETTINGS: "PLATFORM",
    SYSTEM_SETTINGS: "PLATFORM",
    // Billing
    BILLING: "BILLING",
    INVOICE: "BILLING",
    PAYMENT: "BILLING",
    SUBSCRIPTION: "BILLING",
    PLAN: "BILLING",
    // Operations
    INVENTORY: "INVENTORY",
    ORDERING: "ORDERING",
    ACCOMMODATION: "ACCOMMODATION",
    APPOINTMENT: "APPOINTMENT",
    ACADEMIC: "ACADEMIC",
};
/**
 * Get domain (bounded context) for a resource.
 * Returns "system" if resource is not in the map (should not happen with proper typing).
 */
export function getDomainByResource(resource) {
    return RESOURCE_DOMAIN_MAP[resource] || "system";
}
// ═══════════════════════════════════════════════════════════════
// Domain to Portal Mapping (Which sidebar shows in which portal)
// This is the SINGLE SOURCE OF TRUTH for sidebar visibility
// ═══════════════════════════════════════════════════════════════
export const DOMAIN_PORTAL_MAP = {
    // Platform-only domains
    IAM: ["PLATFORM"],
    PLATFORM: ["PLATFORM"],
    SYSTEM: ["PLATFORM"],
    // Shared between Platform and Organization
    ORGANIZATION: ["PLATFORM", "ORGANIZATION"],
    BILLING: ["PLATFORM", "ORGANIZATION"],
    // Organization-only domains
    INVENTORY: ["ORGANIZATION"],
    ORDERING: ["ORGANIZATION"],
    // Capabilities (Organization + Consumer where applicable)
    ACCOMMODATION: ["ORGANIZATION", "CONSUMER"],
    APPOINTMENT: ["ORGANIZATION", "CONSUMER"],
    ACADEMIC: ["ORGANIZATION", "CONSUMER"],
};
/**
 * Get which portals a domain should be visible in.
 * Usage: Filter sidebar items based on user's current portal.
 */
export function getPortalsForDomain(domain) {
    return DOMAIN_PORTAL_MAP[domain] || [];
}
/**
 * Get all domains visible in a specific portal.
 * Usage: Build sidebar menu for a specific portal.
 */
export function getDomainsForPortal(portal) {
    return Object.entries(DOMAIN_PORTAL_MAP)
        .filter(([_, portals]) => portals.includes(portal))
        .map(([domain, _]) => domain);
}
//# sourceMappingURL=permission-domain.js.map