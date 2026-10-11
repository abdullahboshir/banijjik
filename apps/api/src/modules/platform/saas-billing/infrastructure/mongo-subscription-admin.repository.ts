import type { SubscriptionStatus } from "@banijjik/contracts";
import type { UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { SubscriptionAdminRepository } from "../application/ports/subscription-admin-ports.js";
import type { PlatformSubscription } from "../domain/platform-subscription.entity.js";
import { toSubscription } from "./platform-subscription.mapper.js";
import {
  OPEN_SUBSCRIPTION_STATUSES,
  PLATFORM_SUBSCRIPTION_MODEL_NAME,
  type PlatformSubscriptionDocument,
} from "./platform-subscription.schema.js";

type StatusRow = Pick<PlatformSubscriptionDocument, "organizationId" | "status">;

/** Subscriptions are tenant-scoped rows in the platform database; the platform use cases read and write them as system access. */
export class MongoSubscriptionAdminRepository implements SubscriptionAdminRepository {
  async findOpenByOrganization(organizationId: string): Promise<PlatformSubscription | undefined> {
    const row = await this.model()
      .findOne(
        { organizationId, status: { $in: OPEN_SUBSCRIPTION_STATUSES } },
        null,
        sessionOption(getActiveSession()),
      )
      .lean<PlatformSubscriptionDocument>();
    return row === null ? undefined : toSubscription(row);
  }

  async findOpenStatuses(
    organizationIds: readonly string[],
  ): Promise<ReadonlyMap<string, SubscriptionStatus>> {
    if (organizationIds.length === 0) return new Map();
    const rows = await this.model()
      .find(
        {
          organizationId: { $in: [...organizationIds] },
          status: { $in: OPEN_SUBSCRIPTION_STATUSES },
        },
        { organizationId: 1, status: 1, _id: 0 },
      )
      .lean<StatusRow[]>();
    return new Map(rows.map((row) => [row.organizationId, row.status]));
  }

  async update(
    subscription: PlatformSubscription,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<PlatformSubscription> {
    const saved = await updateVersioned<PlatformSubscriptionDocument>({
      model: this.model(),
      filter: { platformSubscriptionId: subscription.platformSubscriptionId },
      expectedVersion,
      update: {
        $set: {
          trialEndsAt: subscription.trialEndsAt,
          basePackageId: subscription.basePackageId,
          addOnPackageIds: [...subscription.addOnPackageIds],
          updatedByUserId: actorUserId,
        },
      },
    });
    return toSubscription(saved);
  }

  async isPackageInUse(packageId: string): Promise<boolean> {
    const found = await this.model()
      .exists({
        status: { $in: OPEN_SUBSCRIPTION_STATUSES },
        $or: [{ basePackageId: packageId }, { addOnPackageIds: packageId }],
      })
      .session(getActiveSession() ?? null);
    return found !== null;
  }

  private model() {
    return models({}).get<PlatformSubscriptionDocument>(PLATFORM_SUBSCRIPTION_MODEL_NAME);
  }
}
