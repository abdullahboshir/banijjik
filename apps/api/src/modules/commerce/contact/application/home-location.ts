import { asId, type LocationId } from "@banijjik/ids";
import { invalidField, locationForbidden } from "../domain/errors.js";
import type { HomeLocationLookup } from "./ports/settings-and-locations.js";

/**
 * A contact belongs to the whole organization; `homeLocationId` is a hint for reports only (09
 * section 5.1). It must still be an ACTIVE location, and one the caller's role reaches.
 */
export async function requireHomeLocation(
  locations: HomeLocationLookup,
  input: {
    readonly homeLocationId: string;
    readonly allowedLocationIds: readonly string[] | "ALL";
  },
): Promise<LocationId> {
  const { homeLocationId, allowedLocationIds } = input;
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(homeLocationId)) {
    throw locationForbidden();
  }
  if (!(await locations.isActiveLocation(homeLocationId))) {
    throw invalidField("homeLocationId", "validation.invalid_value");
  }
  return asId<LocationId>(homeLocationId);
}
