import {
  PLATFORM_AUDIT_ACTION,
  PLATFORM_AUDIT_TARGET_TYPE,
  SYSTEM_REASON,
  type AuditChanges,
  type SubscriptionStatus,
} from "@banijjik/contracts";
import { asId, type PackageId, type UserId } from "@banijjik/ids";
import type { PlatformAuditRecorder } from "../../../../../kernel/audit/index.js";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import type { ConfigVersionBumper } from "../../../../../kernel/tenancy/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { packageKindMismatch, subscriptionNotFound } from "../../domain/errors.js";
import type { PlatformSubscription } from "../../domain/platform-subscription.entity.js";
import type {
  PackageKindLookup,
  SubscriptionAdminRepository,
  SubscriptionUnitOfWork,
} from "../ports/subscription-admin-ports.js";

export interface SubscriptionAdminDependencies {
  readonly subscriptions: SubscriptionAdminRepository;
  readonly packages: PackageKindLookup;
  /** Every write moves `configVersion` in the same transaction, so the next request resolves the change. */
  readonly configVersion: ConfigVersionBumper;
  readonly unitOfWork: SubscriptionUnitOfWork;
  readonly platformAudit: PlatformAuditRecorder;
  readonly clock: Clock;
}

/** A subscription with the keys of its packages, as the platform panel shows it. */
export interface SubscriptionDetail {
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

abstract class SubscriptionSupport {
  constructor(protected readonly dependencies: SubscriptionAdminDependencies) {}

  protected async requireOpen(organizationId: string): Promise<PlatformSubscription> {
    const found = await this.dependencies.subscriptions.findOpenByOrganization(organizationId);
    if (found === undefined) throw subscriptionNotFound();
    return found;
  }

  protected async detailOf(subscription: PlatformSubscription): Promise<SubscriptionDetail> {
    const ids = [subscription.basePackageId, ...subscription.addOnPackageIds];
    const found = await this.dependencies.packages.findByIds(ids);
    const keyOf = (packageId: string): string =>
      found.find((entry) => entry.packageId === packageId)?.packageKey ?? packageId;
    return {
      platformSubscriptionId: subscription.platformSubscriptionId,
      status: subscription.status,
      basePackageId: subscription.basePackageId,
      basePackageKey: keyOf(subscription.basePackageId),
      addOnPackageIds: [...subscription.addOnPackageIds],
      addOnPackageKeys: subscription.addOnPackageIds.map(keyOf),
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      version: subscription.version,
    };
  }

  /** The write, the `configVersion` bump and the audit entry are one transaction. */
  protected save(change: SubscriptionChange): Promise<PlatformSubscription> {
    const { updated, before, actorUserId, audit } = change;
    const { subscriptions, configVersion, unitOfWork, platformAudit } = this.dependencies;
    return unitOfWork.run(async () => {
      const saved = await subscriptions.update(updated, before.version, actorUserId);
      await configVersion.bump(before.organizationId);
      await platformAudit.record({
        action: audit.action,
        targetType: PLATFORM_AUDIT_TARGET_TYPE.subscription,
        targetId: before.platformSubscriptionId,
        organizationId: before.organizationId,
        changes: audit.changes,
        ...(audit.reason === undefined ? {} : { reason: audit.reason }),
      });
      return saved;
    });
  }
}

interface SubscriptionChange {
  readonly updated: PlatformSubscription;
  readonly before: PlatformSubscription;
  readonly actorUserId: UserId;
  readonly audit: {
    readonly action: AuditActionOfSubscription;
    readonly changes: AuditChanges;
    readonly reason?: string;
  };
}

type AuditActionOfSubscription =
  | typeof PLATFORM_AUDIT_ACTION.SUBSCRIPTION_TRIAL_EXTENDED
  | typeof PLATFORM_AUDIT_ACTION.SUBSCRIPTION_PACKAGE_CHANGED;

export class GetSubscriptionUseCase extends SubscriptionSupport {
  async execute(input: { readonly organizationId: string }): Promise<SubscriptionDetail> {
    const found = await this.find(input);
    if (found === undefined) throw subscriptionNotFound();
    return found;
  }

  /** The open subscription of the organization, or undefined; used by the tenant detail. */
  find(input: { readonly organizationId: string }): Promise<SubscriptionDetail | undefined> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const found = await this.dependencies.subscriptions.findOpenByOrganization(
        input.organizationId,
      );
      return found === undefined ? undefined : this.detailOf(found);
    });
  }

  /** The status of the open subscription per organization, for the tenant list (one query). */
  findStatuses(
    organizationIds: readonly string[],
  ): Promise<ReadonlyMap<string, SubscriptionStatus>> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, () =>
      this.dependencies.subscriptions.findOpenStatuses(organizationIds),
    );
  }
}

export interface ExtendTrialInput {
  readonly actorUserId: UserId;
  readonly organizationId: string;
  readonly days: number;
  readonly reason: string;
}

/** Extends the trial of an organization that is still in its trial. */
export class ExtendTrialUseCase extends SubscriptionSupport {
  execute(input: ExtendTrialInput): Promise<SubscriptionDetail> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const before = await this.requireOpen(input.organizationId);
      const extended = before.withTrialExtended(input.days, this.dependencies.clock.now());
      const saved = await this.save({
        updated: extended,
        before,
        actorUserId: input.actorUserId,
        audit: {
          action: PLATFORM_AUDIT_ACTION.SUBSCRIPTION_TRIAL_EXTENDED,
          changes: {
            trialEndsAt: {
              ...(before.trialEndsAt === null ? {} : { from: before.trialEndsAt.toISOString() }),
              ...(extended.trialEndsAt === null ? {} : { to: extended.trialEndsAt.toISOString() }),
            },
          },
          reason: input.reason,
        },
      });
      return this.detailOf(saved);
    });
  }
}

export interface ChangePackageInput {
  readonly actorUserId: UserId;
  readonly organizationId: string;
  readonly basePackageId: string;
  readonly addOnPackageIds: readonly string[];
}

/** Moves a subscription to another base package and add-ons; the status stays. Payment is card 6.2. */
export class ChangePackageUseCase extends SubscriptionSupport {
  execute(input: ChangePackageInput): Promise<SubscriptionDetail> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const before = await this.requireOpen(input.organizationId);
      await this.assertKinds(input);
      const changed = before.withPackages(
        asId<PackageId>(input.basePackageId),
        input.addOnPackageIds.map((packageId) => asId<PackageId>(packageId)),
      );
      const saved = await this.save({
        updated: changed,
        before,
        actorUserId: input.actorUserId,
        audit: {
          action: PLATFORM_AUDIT_ACTION.SUBSCRIPTION_PACKAGE_CHANGED,
          changes: {
            basePackageId: { from: before.basePackageId, to: changed.basePackageId },
            addOnPackageIds: { from: before.addOnPackageIds, to: changed.addOnPackageIds },
          },
        },
      });
      return this.detailOf(saved);
    });
  }

  /** The base must be an ACTIVE base package and each add-on an ACTIVE add-on. */
  private async assertKinds(input: ChangePackageInput): Promise<void> {
    const ids = [input.basePackageId, ...input.addOnPackageIds];
    const found = await this.dependencies.packages.findByIds(ids);
    const isUsable = (packageId: string, isAddOn: boolean): boolean =>
      found.some(
        (entry) => entry.packageId === packageId && entry.isAddOn === isAddOn && entry.isActive,
      );
    const isValid =
      isUsable(input.basePackageId, false) &&
      input.addOnPackageIds.every((packageId) => isUsable(packageId, true));
    if (!isValid) throw packageKindMismatch();
  }
}
