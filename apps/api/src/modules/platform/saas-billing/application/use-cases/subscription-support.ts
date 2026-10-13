import { PLATFORM_AUDIT_TARGET_TYPE } from "@banijjik/contracts";
import { subscriptionNotFound } from "../../domain/errors.js";
import type { PlatformSubscription } from "../../domain/platform-subscription.entity.js";
import type { SubscriptionAdminDependencies } from "./subscription-admin-dependencies.js";
import type { SubscriptionDetail } from "./subscription-detail.js";
import type { SubscriptionChange } from "./subscription-change.js";

export abstract class SubscriptionSupport {
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
      await change.guard?.();
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
