import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  SubscriptionReader,
  SubscriptionRepository,
} from "../application/ports/subscription-repository.js";
import type { SubscriptionView } from "../application/subscription-view.js";
import type { PlatformSubscription } from "../domain/platform-subscription.entity.js";
import { toSubscriptionDocument, toSubscriptionView } from "./platform-subscription.mapper.js";
import {
  OPEN_SUBSCRIPTION_STATUSES,
  PLATFORM_SUBSCRIPTION_MODEL_NAME,
  type PlatformSubscriptionDocument,
} from "./platform-subscription.schema.js";

/** Subscriptions are tenant-scoped rows in the platform database: the tenant plugin filters by organization. */
export class MongoSubscriptionRepository implements SubscriptionRepository, SubscriptionReader {
  async insert(subscription: PlatformSubscription): Promise<void> {
    await this.model().create(
      [toSubscriptionDocument(subscription)],
      sessionOption(getActiveSession()),
    );
  }

  async findOpen(organizationId: string): Promise<SubscriptionView | undefined> {
    const row = await this.model()
      .findOne(
        { organizationId, status: { $in: OPEN_SUBSCRIPTION_STATUSES } },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<PlatformSubscriptionDocument>();
    return row === null ? undefined : toSubscriptionView(row);
  }

  private model() {
    return models({}).get<PlatformSubscriptionDocument>(PLATFORM_SUBSCRIPTION_MODEL_NAME);
  }
}
