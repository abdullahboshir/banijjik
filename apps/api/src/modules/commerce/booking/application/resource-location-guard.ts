import { locationForbidden } from "../domain/errors.js";

export function assertLocationAllowed(
  locationId: string,
  allowedLocationIds: readonly string[] | "ALL",
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
}
