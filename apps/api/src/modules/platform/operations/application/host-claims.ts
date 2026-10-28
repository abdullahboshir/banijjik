import type { OrganizationId, SiteDomainId, UserId } from "@banijjik/ids";

/** What a host resolves to without any tenant read: the routing facts of the platform record. */
export interface HostClaimResolution {
  readonly organizationId: OrganizationId;
  readonly hostname: string;
  /** The generation that owns the routing; a job of another generation is stale (plan 4.2 decision 6). */
  readonly domainGeneration: number;
}

export interface ReserveHostClaimInput {
  /** Normalized by the implementation; an invalid or reserved host is refused. */
  readonly hostname: string;
  readonly organizationId: OrganizationId;
  readonly siteDomainId: SiteDomainId;
  readonly operationGeneration: number;
  /** The staff member who asked, or null for the system (audit only). */
  readonly actorUserId?: UserId | null;
}

export interface DisableHostClaimInput {
  readonly siteDomainId: SiteDomainId;
  readonly operationGeneration: number;
  readonly actorUserId?: UserId | null;
}

/**
 * The narrow port the website uses for platform routing data (plan 4.2 decision 4). It is not a tenant
 * repository: the website never bypasses tenancy, because the claim is platform data by design.
 */
export interface HostClaims {
  /**
   * Reserves the host for the site domain and generation, or refuses it. A retry of the same site
   * domain takes the new generation; a host held by anyone else (or quarantined) is refused.
   */
  reserve(input: ReserveHostClaimInput): Promise<void>;
  /** Stops routing for that site domain; a job of an older generation is refused. Removing twice is harmless. */
  disable(input: DisableHostClaimInput): Promise<void>;
  /** The routing facts of an enabled claim, or undefined for an unknown or removed host. */
  resolve(hostname: string): Promise<HostClaimResolution | undefined>;
}
