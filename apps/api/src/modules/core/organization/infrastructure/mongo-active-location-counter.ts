import { LOCATION_STATUS } from "@banijjik/contracts";
import { models } from "../../../../kernel/db/index.js";
import type { ActiveLocationCounter } from "../application/ports/active-location-counter.js";
import { LOCATION_MODEL_NAME, type LocationDocument } from "./location.schema.js";

/** Counts the ACTIVE locations of the organization of the current tenant context (the tenant plugin scopes it). */
export class MongoActiveLocationCounter implements ActiveLocationCounter {
  countActive(): Promise<number> {
    return models({})
      .get<LocationDocument>(LOCATION_MODEL_NAME)
      .countDocuments({ status: LOCATION_STATUS.ACTIVE })
      .exec();
  }
}
