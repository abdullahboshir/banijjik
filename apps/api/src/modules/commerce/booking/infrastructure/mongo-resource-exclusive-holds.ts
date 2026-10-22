import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { RESOURCE_STATUS } from "@banijjik/contracts/booking";
import { newId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { ResourceExclusiveHoldPort } from "../application/ports/resource-exclusive-holds.js";
import { RESOURCE_MODEL_NAME, type ResourceDocument } from "./booking.schema.js";
import {
  RESOURCE_EXCLUSIVE_HOLD_MODEL,
  RESOURCE_HOLD_GUARD_MODEL,
  type ResourceExclusiveHoldDocument,
  type ResourceHoldGuardDocument,
} from "./resource-exclusive-hold.schema.js";

function holds() {
  return models({}).get<ResourceExclusiveHoldDocument>(RESOURCE_EXCLUSIVE_HOLD_MODEL);
}

function transactionOptions() {
  const session = getActiveSession();
  if (session === undefined) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  return sessionOption(session);
}

/** Serializing on a guard prevents snapshot-isolation write skew in the overlap read. */
async function lockResource(
  resource: Pick<ResourceDocument, "organizationId" | "resourceId">,
  actorUserId: string | null,
): Promise<void> {
  await models({})
    .get<ResourceHoldGuardDocument>(RESOURCE_HOLD_GUARD_MODEL)
    .updateOne(
      { organizationId: resource.organizationId, resourceId: resource.resourceId },
      {
        $inc: { version: 1 },
        $set: { updatedByUserId: actorUserId },
        $setOnInsert: { resourceHoldGuardId: newId(), createdByUserId: actorUserId },
      },
      { upsert: true, ...transactionOptions() },
    );
}

export class MongoResourceExclusiveHolds implements ResourceExclusiveHoldPort {
  async take(input: Parameters<ResourceExclusiveHoldPort["take"]>[0]): Promise<void> {
    transactionOptions();
    for (const resourceId of [...new Set(input.resourceIds)].sort()) {
      await this.takeResource(resourceId, input);
    }
  }

  private async takeResource(
    resourceId: string,
    input: Parameters<ResourceExclusiveHoldPort["take"]>[0],
  ): Promise<void> {
    const resource = await models({})
      .get<ResourceDocument>(RESOURCE_MODEL_NAME)
      .findOne(
        { resourceId, locationId: input.locationId, status: RESOURCE_STATUS.ACTIVE, capacity: 1 },
        { organizationId: 1, resourceId: 1 },
      )
      .session(getActiveSession() ?? null)
      .lean();
    if (resource === null) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    await lockResource(resource, input.actorUserId);
    const overlap = await holds()
      .exists({
        resourceId,
        $or: [{ endsOn: null }, { endsOn: { $gt: input.startsOn } }],
        ...(input.endsOn === null ? {} : { startsOn: { $lt: input.endsOn } }),
      })
      .session(getActiveSession() ?? null);
    if (overlap !== null) throw new DomainRuleError({ code: ERROR_CODE.CAPACITY_FULL });
    await holds().create(
      [
        {
          resourceExclusiveHoldId: newId(),
          organizationId: resource.organizationId,
          locationId: input.locationId,
          resourceId,
          enrollmentId: input.enrollmentId,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          version: 1,
          createdByUserId: input.actorUserId,
          updatedByUserId: input.actorUserId,
        },
      ],
      transactionOptions(),
    );
  }

  async release(enrollmentId: string, endsOn: string, actorUserId: string | null): Promise<void> {
    transactionOptions();
    const rows = await holds()
      .find({ enrollmentId, endsOn: null }, { organizationId: 1, resourceId: 1 })
      .session(getActiveSession() ?? null)
      .lean();
    for (const row of rows.sort((left, right) => left.resourceId.localeCompare(right.resourceId))) {
      await lockResource(row, actorUserId);
    }
    await holds().updateMany(
      { enrollmentId, endsOn: null },
      { $set: { endsOn, updatedByUserId: actorUserId }, $inc: { version: 1 } },
      transactionOptions(),
    );
  }
}
