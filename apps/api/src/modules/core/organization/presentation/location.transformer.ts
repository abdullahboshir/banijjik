import type { LocationResponse } from "@banijjik/contracts";
import type { Location } from "../domain/location.entity.js";

export function toLocationResponse(location: Location): LocationResponse {
  return {
    locationId: location.locationId,
    name: location.name,
    locationType: location.locationType,
    isDefault: location.isDefault,
    status: location.status,
    version: location.version,
    ...(location.address === undefined ? {} : { address: { ...location.address } }),
    ...(location.phoneE164 === undefined ? {} : { phoneE164: location.phoneE164 }),
    ...(location.timezone === undefined ? {} : { timezone: location.timezone }),
  };
}
