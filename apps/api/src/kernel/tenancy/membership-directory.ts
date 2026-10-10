import type { OrganizationDeployment, OrganizationStatus } from "@banijjik/contracts";

export interface MembershipAssignment {
  readonly locationId: string;
  readonly roleId: string;
}

/** What the tenant context needs to know about one user in one organization. */
export interface ActiveMembership {
  readonly memberId: string;
  readonly organizationStatus: OrganizationStatus;
  readonly deployment: OrganizationDeployment;
  /** `locationId` is a location ID or "ALL". */
  readonly assignments: readonly MembershipAssignment[];
}

/**
 * Port implemented by core/organization. It answers "is this user an active member of this
 * organization?" for a request that has no organization yet, so it runs as system access
 * (AUTH_LOOKUP) through asSystemPort in routes/v1.ts.
 */
export interface MembershipDirectory {
  /** Undefined when there is no ACTIVE membership or the organization is CLOSED. */
  findActiveMembership(
    userId: string,
    organizationId: string,
  ): Promise<ActiveMembership | undefined>;
}
