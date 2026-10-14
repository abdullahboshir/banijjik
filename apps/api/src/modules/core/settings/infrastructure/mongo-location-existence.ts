import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { LocationExistence } from "../application/ports/location-existence.js";

/**
 * The location model is registered by core/organization. Settings does not add an export there:
 * wave 1 leaves that module to its manifest. The name is the registered model name.
 */
const LOCATION_MODEL_NAME = "Location";

export class MongoLocationExistence implements LocationExistence {
  async exists(locationId: string): Promise<boolean> {
    const row = await models({})
      .get<{ locationId: string }>(LOCATION_MODEL_NAME)
      .findOne({ locationId }, { locationId: 1, _id: 0 }, sessionOption(getActiveSession()))
      .lean<{ locationId: string }>();
    return row !== null;
  }
}
