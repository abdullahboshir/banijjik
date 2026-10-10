import { asId, type LocationId, type OrganizationId } from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import { toAuthorId } from "./author-id.js";
import { Location } from "../domain/location.entity.js";
import type { LocationDocument } from "./location.schema.js";

/** The document to insert. Optional fields that are absent are left out, not stored as null. */
export function toLocationDocument(location: Location): LocationDocument {
  return {
    locationId: location.locationId,
    organizationId: location.organizationId,
    name: location.name,
    locationType: location.locationType,
    isDefault: location.isDefault,
    status: location.status,
    version: location.version,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
    createdByUserId: location.createdByUserId,
    updatedByUserId: null,
    ...(location.address === undefined ? {} : { address: location.address }),
    ...(location.phoneE164 === undefined ? {} : { phoneE164: location.phoneE164 }),
    ...(location.timezone === undefined ? {} : { timezone: location.timezone }),
  };
}

export function toLocation(document: LocationDocument): Location {
  const stored = stripMongoInternals(document);
  return Location.restore({
    locationId: asId<LocationId>(stored.locationId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    name: stored.name,
    locationType: stored.locationType,
    isDefault: stored.isDefault,
    status: stored.status,
    address: stored.address,
    phoneE164: stored.phoneE164,
    timezone: stored.timezone,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    createdByUserId: toAuthorId(stored.createdByUserId),
  });
}
