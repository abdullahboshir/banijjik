import type { IndustryTemplateKey, OrganizationStatus } from "@banijjik/contracts";

/** What the platform panel may read of an organization. */
export interface OrganizationAdminView {
  readonly organizationId: string;
  readonly slug: string;
  readonly name: string;
  readonly status: OrganizationStatus;
  /** The industry template of the organization, shown as is; nothing branches on it (ADR-033). */
  readonly templateKey: IndustryTemplateKey;
  readonly ownerUserId: string;
  readonly version: number;
  readonly createdAt: Date;
}

export interface OrganizationDirectoryQuery {
  readonly page: number;
  readonly limit: number;
  readonly status?: OrganizationStatus | undefined;
  /** A prefix of the slug or of the name. */
  readonly search?: string | undefined;
}

export interface OrganizationDirectoryPage {
  readonly items: readonly OrganizationAdminView[];
  readonly hasNext: boolean;
}

/**
 * Cross-organization reads for the platform panel (card 1.8a). Members and locations are tenant
 * data, so the caller reads them under `runAsSystem(PLATFORM_ADMIN)` in a platform use case; this
 * module only answers, and never decides who may ask.
 */
export interface OrganizationDirectory {
  list(query: OrganizationDirectoryQuery): Promise<OrganizationDirectoryPage>;
  findById(organizationId: string): Promise<OrganizationAdminView | undefined>;
  /** ACTIVE members per organization, in one aggregate. Organizations without members are missing from the map. */
  countActiveMembers(organizationIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  countActiveLocations(organizationId: string): Promise<number>;
  /** The display name of the owner member, the person the platform contacts. */
  findOwnerDisplayName(organizationId: string, ownerUserId: string): Promise<string | undefined>;
}
