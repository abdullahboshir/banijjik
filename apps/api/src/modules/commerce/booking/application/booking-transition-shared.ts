import type { BookingId } from "@banijjik/ids";
import { locationForbidden } from "../domain/errors.js";

export function assertLocationAllowed(
  locationId: string,
  allowedLocationIds: readonly string[] | "ALL",
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
}

export function formatBookingNumber(value: number): string {
  return String(value).padStart(6, "0");
}

export function bookingOrderingKey(bookingId: BookingId): string {
  return `booking:${bookingId}`;
}
