import { type SubscriptionStatus } from "@banijjik/contracts";

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
