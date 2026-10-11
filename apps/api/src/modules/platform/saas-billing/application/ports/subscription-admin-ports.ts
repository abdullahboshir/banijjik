import type { SubscriptionStatus } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import type { PlatformSubscription } from "../../domain/platform-subscription.entity.js";

/** The package fields the platform checks before it attaches a package to a subscription. */
export interface PackageKindView {
  readonly packageId: string;
  readonly packageKey: string;
  readonly isAddOn: boolean;
  readonly isActive: boolean;
}

/** Implemented from platform/package in index.ts. */
export interface PackageKindLookup {
  findByIds(packageIds: readonly string[]): Promise<readonly PackageKindView[]>;
}

/** Subscriptions are tenant-scoped rows: the callers run these under runAsSystem(PLATFORM_ADMIN). */
export interface SubscriptionAdminRepository {
  findOpenByOrganization(organizationId: string): Promise<PlatformSubscription | undefined>;
  /** The status of the open subscription per organization, in one query. */
  findOpenStatuses(
    organizationIds: readonly string[],
  ): Promise<ReadonlyMap<string, SubscriptionStatus>>;
  /** Saves the trial end and the packages; a stale `expectedVersion` is a 409. */
  update(
    subscription: PlatformSubscription,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<PlatformSubscription>;
  /** Is the package the base or an add-on of any open subscription? */
  isPackageInUse(packageId: string): Promise<boolean>;
}

export interface SubscriptionUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
