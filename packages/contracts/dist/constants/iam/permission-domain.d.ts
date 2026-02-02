import { PermissionResourceType } from "./permission-resource";
import { PortalType } from "./portal-type";
export declare const PERMISSION_DOMAIN_ENUM: readonly ["IAM", "ORGANIZATION", "PLATFORM", "BILLING", "INVENTORY", "ORDERING", "ACCOMMODATION", "APPOINTMENT", "ACADEMIC", "SYSTEM"];
export type PermissionDomainType = (typeof PERMISSION_DOMAIN_ENUM)[number];
export declare const PERMISSION_DOMAIN: any;
export declare const RESOURCE_DOMAIN_MAP: Record<PermissionResourceType, PermissionDomainType>;
/**
 * Get domain (bounded context) for a resource.
 * Returns "system" if resource is not in the map (should not happen with proper typing).
 */
export declare function getDomainByResource(resource: string): PermissionDomainType;
export declare const DOMAIN_PORTAL_MAP: Record<PermissionDomainType, PortalType[]>;
/**
 * Get which portals a domain should be visible in.
 * Usage: Filter sidebar items based on user's current portal.
 */
export declare function getPortalsForDomain(domain: PermissionDomainType): PortalType[];
/**
 * Get all domains visible in a specific portal.
 * Usage: Build sidebar menu for a specific portal.
 */
export declare function getDomainsForPortal(portal: PortalType): PermissionDomainType[];
//# sourceMappingURL=permission-domain.d.ts.map