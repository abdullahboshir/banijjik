import type { ResourceId } from "@banijjik/ids";
import type { Model } from "mongoose";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type {
  ResourceTimeOffRecord,
  ResourceTimeOffRepository,
} from "../application/ports/booking-repositories.js";
import { RESOURCE_TIME_OFF_MODEL_NAME, type ResourceTimeOffDocument } from "./booking.schema.js";

function timeOffModel(): Model<ResourceTimeOffDocument> {
  return models({}).get<ResourceTimeOffDocument>(RESOURCE_TIME_OFF_MODEL_NAME);
}

export class MongoResourceTimeOffRepository implements ResourceTimeOffRepository {
  async insert(record: ResourceTimeOffRecord): Promise<void> {
    await timeOffModel().create([record], sessionOption(getActiveSession()));
  }

  async listForResource(resourceId: ResourceId): Promise<readonly ResourceTimeOffRecord[]> {
    return timeOffModel()
      .find({ resourceId })
      .sort({ startsAt: 1 })
      .lean<ResourceTimeOffDocument[]>();
  }

  async listOverlapping(input: {
    readonly resourceId: ResourceId;
    readonly from: Date;
    readonly to: Date;
  }): Promise<readonly ResourceTimeOffRecord[]> {
    return timeOffModel()
      .find({
        resourceId: input.resourceId,
        startsAt: { $lt: input.to },
        endsAt: { $gt: input.from },
      })
      .lean<ResourceTimeOffDocument[]>();
  }
}
