import type { SubscriptionStatus } from "@banijjik/contracts";

/** What entitlement may read of a subscription. */
export interface SubscriptionView {
  readonly platformSubscriptionId: string;
  readonly basePackageId: string;
  readonly addOnPackageIds: readonly string[];
  readonly status: SubscriptionStatus;
  readonly trialEndsAt: Date | null;
  readonly currentPeriodEnd: Date | null;
}
