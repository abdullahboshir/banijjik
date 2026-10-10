import type { OrganizationId } from "@banijjik/ids";

/**
 * Increments `Organization.rolesVersion`, which keys the permission cache. Implemented by
 * core/organization (it owns the organization). It joins the surrounding unit of work, so a role
 * change and its version bump commit together or not at all.
 */
export interface RolesVersionBumper {
  bump(organizationId: OrganizationId): Promise<void>;
}
