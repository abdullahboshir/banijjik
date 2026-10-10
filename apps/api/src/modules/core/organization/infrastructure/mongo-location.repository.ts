import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import type { LocationRepository } from "../application/ports/repositories.js";
import type { Location } from "../domain/location.entity.js";
import { toLocationDocument } from "./location.mapper.js";
import { LOCATION_MODEL_NAME, type LocationDocument } from "./location.schema.js";

/** A platform model with an explicit `organizationId` on every document; the tenant plugin arrives with card 1.3. */
export class MongoLocationRepository implements LocationRepository {
  async insert(location: Location): Promise<void> {
    await this.model().create([toLocationDocument(location)], sessionOption(getActiveSession()));
  }

  private model() {
    return models({}).get<LocationDocument>(LOCATION_MODEL_NAME);
  }
}
