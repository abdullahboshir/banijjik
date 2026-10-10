import type { PlatformSubscription } from "../../domain/platform-subscription.entity.js";
import type { SubscriptionView } from "../subscription-view.js";

export interface SubscriptionRepository {
  insert(subscription: PlatformSubscription): Promise<void>;
}

/** The read side for entitlement. Runs in the organization context of the request or the event. */
export interface SubscriptionReader {
  /** The one open (not cancelled) subscription of the organization, if any. */
  findOpen(organizationId: string): Promise<SubscriptionView | undefined>;
}
