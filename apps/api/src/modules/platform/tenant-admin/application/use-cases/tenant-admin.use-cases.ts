import {
  DomainRuleError,
  ERROR_CODE,
  SYSTEM_REASON,
  type OrganizationStatus,
  type SubscriptionStatus,
} from "@banijjik/contracts";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { maskIdentifier } from "../../domain/mask-identifier.js";
import type {
  OwnerIdentifierReader,
  TenantDirectory,
  TenantDirectoryQuery,
  TenantLifecycle,
  TenantOrganizationView,
  TenantOverrideReader,
  TenantOverrideView,
  TenantStatusChange,
  TenantSubscriptionReader,
  TenantSubscriptionView,
} from "../ports/tenant-admin-ports.js";

export interface TenantAdminDependencies {
  readonly directory: TenantDirectory;
  readonly subscriptions: TenantSubscriptionReader;
  readonly overrides: TenantOverrideReader;
  readonly identifiers: OwnerIdentifierReader;
  readonly lifecycle: TenantLifecycle;
  readonly clock: Clock;
}

export interface TenantSummary {
  readonly organization: TenantOrganizationView;
  readonly subscriptionStatus: SubscriptionStatus | null;
  readonly memberCount: number;
}

export interface TenantSummaryPage {
  readonly items: readonly TenantSummary[];
  readonly hasNext: boolean;
}

export interface TenantDetail extends TenantSummary {
  readonly locationCount: number;
  readonly ownerDisplayName: string;
  readonly ownerMaskedIdentifier: string;
  readonly subscription: TenantSubscriptionView | null;
  readonly moduleOverrides: readonly TenantOverrideView[];
}

function notFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/**
 * One page of organizations with their subscription status and member count. Three queries
 * whatever the page size: the page, one member aggregate and one subscription lookup. Members are
 * tenant data, so the page is read as system access (PLATFORM_ADMIN) and leaves a log line.
 */
export class ListTenantsUseCase {
  constructor(private readonly dependencies: TenantAdminDependencies) {}

  execute(query: TenantDirectoryQuery): Promise<TenantSummaryPage> {
    const { directory, subscriptions } = this.dependencies;
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const page = await directory.list(query);
      const ids = page.items.map((entry) => entry.organizationId);
      const [memberCounts, statuses] = await Promise.all([
        directory.countActiveMembers(ids),
        subscriptions.findStatuses(ids),
      ]);
      const items = page.items.map((organization) => ({
        organization,
        subscriptionStatus: statuses.get(organization.organizationId) ?? null,
        memberCount: memberCounts.get(organization.organizationId) ?? 0,
      }));
      return { items, hasNext: page.hasNext };
    });
  }
}

/** The detail of one organization: subscription, active overrides, locations and the masked owner contact. */
export class GetTenantUseCase {
  constructor(private readonly dependencies: TenantAdminDependencies) {}

  execute(input: { readonly organizationId: string }): Promise<TenantDetail> {
    const { directory, subscriptions, overrides, identifiers } = this.dependencies;
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const organization = await directory.findById(input.organizationId);
      if (organization === undefined) throw notFound();
      const [memberCounts, statuses, locationCount, ownerName, subscription, moduleOverrides] =
        await Promise.all([
          directory.countActiveMembers([organization.organizationId]),
          subscriptions.findStatuses([organization.organizationId]),
          directory.countActiveLocations(organization.organizationId),
          directory.findOwnerDisplayName(organization.organizationId, organization.ownerUserId),
          subscriptions.find({ organizationId: organization.organizationId }),
          overrides.list(organization.organizationId),
        ]);
      const ownerIdentifiers = await identifiers.findIdentifiers(organization.ownerUserId);
      return {
        organization,
        subscriptionStatus: statuses.get(organization.organizationId) ?? null,
        memberCount: memberCounts.get(organization.organizationId) ?? 0,
        locationCount,
        ownerDisplayName: ownerName ?? "",
        ownerMaskedIdentifier: maskIdentifier(ownerIdentifiers ?? {}),
        subscription: subscription ?? null,
        moduleOverrides: activeOnly(moduleOverrides, this.dependencies.clock.now()),
      };
    });
  }
}

/** Expired overrides no longer count; the list endpoint still shows every row. */
function activeOnly(rows: readonly TenantOverrideView[], now: Date): readonly TenantOverrideView[] {
  return rows.filter((row) => row.expiresAt === null || row.expiresAt.getTime() > now.getTime());
}

export interface TenantStatusResult {
  readonly status: OrganizationStatus;
  readonly version: number;
}

export class SuspendTenantUseCase {
  constructor(private readonly dependencies: TenantAdminDependencies) {}

  execute(input: TenantStatusChange): Promise<TenantStatusResult> {
    return this.dependencies.lifecycle.suspend(input);
  }
}

export class ReactivateTenantUseCase {
  constructor(private readonly dependencies: TenantAdminDependencies) {}

  execute(input: TenantStatusChange): Promise<TenantStatusResult> {
    return this.dependencies.lifecycle.reactivate(input);
  }
}
