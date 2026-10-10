import { TRIAL_PACKAGE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId, type PackageId } from "@banijjik/ids";
import type { Clock } from "../../../../../kernel/time/index.js";
import { trialPackageMissing } from "../../domain/errors.js";
import { PlatformSubscription } from "../../domain/platform-subscription.entity.js";
import type { BasePackageLookup } from "../ports/base-package-lookup.js";
import type { SubscriptionRepository } from "../ports/subscription-repository.js";

export interface StartTrialDependencies {
  readonly subscriptions: SubscriptionRepository;
  readonly basePackages: BasePackageLookup;
  readonly clock: Clock;
}

/**
 * Gives a new organization its 14-day BUNDLE trial. It runs inside the create-organization
 * transaction, as the new organization, so the trial and the organization exist together or not at
 * all. Without a seeded BUNDLE package the business is not created.
 *
 * It does not bump `Organization.configVersion`: the organization is created in the same
 * transaction at version 1, so no config can have been cached before the trial exists. A later
 * writer of a subscription or an override must bump it (ConfigVersionBumper).
 */
export class StartTrialUseCase {
  constructor(private readonly dependencies: StartTrialDependencies) {}

  async execute(organizationId: OrganizationId): Promise<void> {
    const { subscriptions, basePackages, clock } = this.dependencies;
    const basePackageId = await basePackages.findActiveBasePackageId(TRIAL_PACKAGE_KEY);
    if (basePackageId === undefined) throw trialPackageMissing();
    await subscriptions.insert(
      PlatformSubscription.startTrial({
        organizationId,
        basePackageId: asId<PackageId>(basePackageId),
        now: clock.now(),
      }),
    );
  }
}
