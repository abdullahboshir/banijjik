import type { OrganizationId } from "@banijjik/ids";
import type { Clock } from "../../../kernel/time/index.js";
import { buildPackageReader } from "../package/index.js";
import type { SubscriptionReader } from "./application/ports/subscription-repository.js";
import { StartTrialUseCase } from "./application/use-cases/start-trial.use-case.js";
import { MongoSubscriptionRepository } from "./infrastructure/mongo-subscription.repository.js";

export { accessModeOf } from "./domain/access-mode.js";
export type { AccessState, SubscriptionDates } from "./domain/access-mode.js";
export { registerSaasBillingModels } from "./infrastructure/register-saas-billing-models.js";
export { saasBillingManifest } from "./module.manifest.js";
export type { SubscriptionReader } from "./application/ports/subscription-repository.js";
export type { SubscriptionView } from "./application/subscription-view.js";

/** The port core/organization calls inside its create transaction. */
export interface TrialStarter {
  start(organizationId: OrganizationId): Promise<void>;
}

export function buildTrialStarter(clock: Clock): TrialStarter {
  const packages = buildPackageReader();
  const useCase = new StartTrialUseCase({
    subscriptions: new MongoSubscriptionRepository(),
    basePackages: {
      findActiveBasePackageId: async (packageKey) =>
        (await packages.findActiveBaseByKey(packageKey))?.packageId,
    },
    clock,
  });
  return { start: (organizationId) => useCase.execute(organizationId) };
}

/** The read side for entitlement. */
export function buildSubscriptionReader(): SubscriptionReader {
  return new MongoSubscriptionRepository();
}
