import { LOCATION_STATUS } from "@banijjik/contracts";
import type { LocationId, UserId } from "@banijjik/ids";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import type { LocationRepository } from "../application/ports/repositories.js";
import type {
  LocationListRequest,
  LocationManagementRepository,
  Page,
} from "../application/ports/profile-and-location-repositories.js";
import type { Location } from "../domain/location.entity.js";
import { toDuplicateFieldError } from "./duplicate-field.js";
import { toLocation, toLocationDocument } from "./location.mapper.js";
import { LOCATION_MODEL_NAME, type LocationDocument } from "./location.schema.js";

const LIST_SORT = { name: 1, locationId: 1 } as const;

/** Locations are tenant data: the tenant plugin adds the organization filter to every query (ADR-087). */
export class MongoLocationRepository implements LocationRepository, LocationManagementRepository {
  async insert(location: Location): Promise<void> {
    try {
      await this.model().create([toLocationDocument(location)], sessionOption(getActiveSession()));
    } catch (error) {
      throw toDuplicateFieldError(error, "name");
    }
  }

  async findById(locationId: LocationId): Promise<Location | undefined> {
    const document = await this.model()
      .findOne({ locationId }, null, sessionOption(getActiveSession()))
      .lean<LocationDocument>();
    return document === null ? undefined : toLocation(document);
  }

  async touchActive(locationIds: readonly LocationId[]): Promise<number> {
    if (locationIds.length === 0) return 0;
    const result = await this.model().updateMany(
      { locationId: { $in: locationIds }, status: LOCATION_STATUS.ACTIVE },
      { $inc: { referenceVersion: 1 } },
      // The counter is a guard, not a change of the location: its updatedAt stays.
      { ...sessionOption(getActiveSession()), timestamps: false },
    );
    return result.matchedCount;
  }

  async list(request: LocationListRequest): Promise<Page<Location>> {
    const { visibleLocationIds, status, page, limit } = request;
    const filter = {
      ...(status === undefined ? {} : { status }),
      ...(visibleLocationIds === "ALL" ? {} : { locationId: { $in: [...visibleLocationIds] } }),
    };
    // One extra row tells whether another page exists, without counting the collection.
    const documents = await this.model()
      .find(filter, null, sessionOption(getActiveSession()))
      .sort(LIST_SORT)
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<LocationDocument[]>();
    return { items: documents.slice(0, limit).map(toLocation), hasNext: documents.length > limit };
  }

  countActive(): Promise<number> {
    return this.model()
      .countDocuments({ status: LOCATION_STATUS.ACTIVE })
      .session(getActiveSession() ?? null)
      .exec();
  }

  async update(
    location: Location,
    expectedVersion: number,
    actorUserId: UserId,
  ): Promise<Location> {
    try {
      const saved = await updateVersioned<LocationDocument>({
        model: this.model(),
        filter: { locationId: location.locationId },
        expectedVersion,
        update: {
          $set: {
            name: location.name,
            locationType: location.locationType,
            status: location.status,
            updatedByUserId: actorUserId,
            ...(location.address === undefined ? {} : { address: location.address }),
            ...(location.phoneE164 === undefined ? {} : { phoneE164: location.phoneE164 }),
            ...(location.timezone === undefined ? {} : { timezone: location.timezone }),
          },
        },
      });
      return toLocation(saved);
    } catch (error) {
      throw toDuplicateFieldError(error, "name");
    }
  }

  private model() {
    return models({}).get<LocationDocument>(LOCATION_MODEL_NAME);
  }
}
