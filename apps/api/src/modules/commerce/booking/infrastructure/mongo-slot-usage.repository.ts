import { newId, type OrganizationId, type ResourceId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { bucketStartsCovering } from "../domain/buckets.js";
import { slotUnavailableError } from "../domain/errors.js";
import {
  RESOURCE_SLOT_USAGE_MODEL_NAME,
  type ResourceSlotUsageDocument,
} from "./booking.schema.js";

function slotModel(): Model<ResourceSlotUsageDocument> {
  return models({}).get<ResourceSlotUsageDocument>(RESOURCE_SLOT_USAGE_MODEL_NAME);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

/**
 * Takes one unit of capacity in a 5-minute bucket via conditional upsert.
 * Equality fields on the filter supply organizationId for the tenant plugin and for upsert.
 */
async function takeOneBucket(input: {
  readonly organizationId: OrganizationId;
  readonly resourceId: ResourceId;
  readonly capacity: number;
  readonly bucketStart: Date;
}): Promise<void> {
  try {
    const updated = await slotModel().findOneAndUpdate(
      {
        organizationId: input.organizationId,
        resourceId: input.resourceId,
        bucketStart: input.bucketStart,
        used: { $lt: input.capacity },
      },
      {
        $inc: { used: 1 },
        $setOnInsert: {
          resourceSlotUsageId: newId(),
        },
      },
      { upsert: true, returnDocument: "after", ...sessionOption(getActiveSession()) },
    );
    if (updated === null || updated.used > input.capacity) {
      throw slotUnavailableError();
    }
  } catch (error) {
    if (isDuplicateKey(error)) throw slotUnavailableError();
    throw error;
  }
}

export class MongoResourceSlotUsageRepository {
  async takeCapacity(input: {
    readonly organizationId: OrganizationId;
    readonly resourceId: ResourceId;
    readonly capacity: number;
    readonly startsAt: Date;
    readonly blockedEndsAt: Date;
  }): Promise<void> {
    const buckets = bucketStartsCovering(input.startsAt, input.blockedEndsAt);
    for (const bucketStart of buckets) {
      await takeOneBucket({
        organizationId: input.organizationId,
        resourceId: input.resourceId,
        capacity: input.capacity,
        bucketStart,
      });
    }
  }

  async releaseCapacity(input: {
    readonly organizationId: OrganizationId;
    readonly resourceId: ResourceId;
    readonly startsAt: Date;
    readonly blockedEndsAt: Date;
  }): Promise<void> {
    const buckets = bucketStartsCovering(input.startsAt, input.blockedEndsAt);
    for (const bucketStart of buckets) {
      await slotModel().updateOne(
        {
          organizationId: input.organizationId,
          resourceId: input.resourceId,
          bucketStart,
          used: { $gt: 0 },
        },
        { $inc: { used: -1 } },
        sessionOption(getActiveSession()),
      );
    }
  }

  async readUsedByBucket(input: {
    readonly organizationId: OrganizationId;
    readonly resourceId: ResourceId;
    readonly startsAt: Date;
    readonly blockedEndsAt: Date;
  }): Promise<Map<number, number>> {
    const buckets = bucketStartsCovering(input.startsAt, input.blockedEndsAt);
    if (buckets.length === 0) return new Map();
    const rows = await slotModel()
      .find(
        {
          organizationId: input.organizationId,
          resourceId: input.resourceId,
          bucketStart: { $in: buckets },
        },
        { bucketStart: 1, used: 1 },
      )
      .lean<{ bucketStart: Date; used: number }[]>();
    const out = new Map<number, number>();
    for (const row of rows) out.set(row.bucketStart.getTime(), row.used);
    return out;
  }
}
