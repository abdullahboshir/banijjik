import { PLATFORM_AUDIT_ACTION, type AuditChanges } from "@banijjik/contracts";
import { type UserId } from "@banijjik/ids";
import type { PlatformSubscription } from "../../domain/platform-subscription.entity.js";

export interface SubscriptionChange {
  /** Runs first inside the transaction, e.g. to touch the packages the change attaches. */
  readonly guard?: () => Promise<void>;
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
