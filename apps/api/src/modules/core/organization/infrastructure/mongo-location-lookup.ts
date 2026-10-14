import { LOCATION_STATUS } from "@banijjik/contracts";
import { models } from "../../../../kernel/db/index.js";
import type { LocationLookup } from "../application/ports/location-lookup.js";
import { LOCATION_MODEL_NAME, type LocationDocument } from "./location.schema.js";

/** ACTIVE locations of the organization of the current tenant context (the tenant plugin scopes it). */
export class MongoLocationLookup implements LocationLookup {
  async isActiveLocation(locationId: string): Promise<boolean> {
    const row = await models({})
      .get<LocationDocument>(LOCATION_MODEL_NAME)
      .findOne({ locationId, status: LOCATION_STATUS.ACTIVE }, { locationId: 1, _id: 0 })
      .lean<{ locationId: string }>();
    return row !== null;
  }
}
