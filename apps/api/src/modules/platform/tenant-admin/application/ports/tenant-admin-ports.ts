import type { OrganizationStatus, SubscriptionStatus } from "@banijjik/contracts";
import type { OrganizationAdminView } from "../../../../core/organization/index.js";

/** What the tenant list and detail read of an organization. Implemented by core/organization. */
export type TenantOrganizationView = OrganizationAdminView;

export interface TenantDirectoryQuery {
  readonly page: number;
  readonly limit: number;
  readonly status?: OrganizationStatus | undefined;
  readonly search?: string | undefined;
}

/** Members and locations are tenant data: the use cases read them under runAsSystem(PLATFORM_ADMIN). */
export interface TenantDirectory {
  list(
    query: TenantDirectoryQuery,
  ): Promise<{ items: readonly TenantOrganizationView[]; hasNext: boolean }>;
  findById(organizationId: string): Promise<TenantOrganizationView | undefined>;
  countActiveMembers(organizationIds: readonly string[]): Promise<ReadonlyMap<string, number>>;
  countActiveLocations(organizationId: string): Promise<number>;
  findOwnerDisplayName(organizationId: string, ownerUserId: string): Promise<string | undefined>;
}

export interface TenantSubscriptionView {
  readonly platformSubscriptionId: string;
  readonly status: SubscriptionStatus;
  readonly basePackageId: string;
  readonly basePackageKey: string;
  readonly addOnPackageIds: readonly string[];
  readonly addOnPackageKeys: readonly string[];
  readonly trialEndsAt: Date | null;
  readonly currentPeriodEnd: Date | null;
  readonly version: number;
}

/** Implemented by platform/saas-billing; both reads run as system access themselves. */
export interface TenantSubscriptionReader {
  find(input: { readonly organizationId: string }): Promise<TenantSubscriptionView | undefined>;
  findStatuses(
    organizationIds: readonly string[],
  ): Promise<ReadonlyMap<string, SubscriptionStatus>>;
}

export interface TenantOverrideView {
  readonly moduleOverrideId: string;
  readonly moduleKey: string;
  readonly effect: string;
  readonly reason: string;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

/** Implemented by platform/entitlement; the caller reads under runAsSystem(PLATFORM_ADMIN). */
export interface TenantOverrideReader {
  list(organizationId: string): Promise<readonly TenantOverrideView[]>;
}

/** The email or phone number of the owner, to be masked. Implemented by core/iam. */
export interface OwnerIdentifierReader {
  findIdentifiers(
    userId: string,
  ): Promise<{ email: string | undefined; phoneE164: string | undefined } | undefined>;
}

export interface TenantStatusChange {
  readonly organizationId: string;
  readonly actorUserId: string;
  readonly reason: string;
}

/** Suspend and reactivate, owned by core/organization. */
export interface TenantLifecycle {
  suspend(input: TenantStatusChange): Promise<{ status: OrganizationStatus; version: number }>;
  reactivate(input: TenantStatusChange): Promise<{ status: OrganizationStatus; version: number }>;
}
