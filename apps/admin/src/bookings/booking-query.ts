import type { BookingResponse } from "@banijjik/contracts/booking";
import { addCalendarDays, localDateTimeToIso } from "./booking-local-time";

type RawParam = string | string[] | undefined;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const BOOKINGS_PAGE_SIZE = 100;

export interface BookingCalendarQuery {
  locationId: string | undefined;
  date: string;
}

function firstOf(value: RawParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function idOf(value: string | undefined): string | undefined {
  return value !== undefined && UUID_PATTERN.test(value) ? value : undefined;
}

function dateOf(value: string | undefined): string | undefined {
  return value !== undefined && DATE_PATTERN.test(value) ? value : undefined;
}

/** Today in the organization's timezone as YYYY-MM-DD. */
export function todayInTimeZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseBookingCalendarQuery(
  params: Record<string, RawParam>,
  timeZone: string,
): BookingCalendarQuery {
  const locationId = idOf(firstOf(params["location"]));
  const date = dateOf(firstOf(params["date"])) ?? todayInTimeZone(timeZone);
  return { locationId, date };
}

function toSearchParams(query: BookingCalendarQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.locationId) params.set("location", query.locationId);
  if (query.date) params.set("date", query.date);
  return params;
}

export function bookingCalendarHref(basePath: string, query: BookingCalendarQuery): string {
  const text = toSearchParams(query).toString();
  return text === "" ? basePath : `${basePath}?${text}`;
}

export function bookingsApiQuery(organizationId: string, query: BookingCalendarQuery): string {
  const params = new URLSearchParams();
  if (query.locationId) params.set("locationId", query.locationId);
  params.set("date", query.date);
  params.set("page", "1");
  params.set("limit", String(BOOKINGS_PAGE_SIZE));
  return `/orgs/${organizationId}/bookings?${params.toString()}`;
}

/** A rental can run up to 31 days (ADR-133); the list filters by start, so look this far back. */
export const MAX_RENTAL_LOOKBACK_DAYS = 31;

/** Rentals that started before the shown day: the list filters by start time only. */
export function earlierRentalsApiQuery(
  organizationId: string,
  query: BookingCalendarQuery,
  timeZone: string,
): string {
  const params = new URLSearchParams();
  if (query.locationId) params.set("locationId", query.locationId);
  params.set(
    "from",
    localDateTimeToIso(addCalendarDays(query.date, -MAX_RENTAL_LOOKBACK_DAYS), "00:00", timeZone),
  );
  params.set(
    "to",
    new Date(Date.parse(localDateTimeToIso(query.date, "00:00", timeZone)) - 1).toISOString(),
  );
  params.set("page", "1");
  params.set("limit", String(BOOKINGS_PAGE_SIZE));
  return `/orgs/${organizationId}/bookings?${params.toString()}`;
}

/** Keeps the earlier bookings that are rentals still running on the shown day. */
export function runningRentalsOf(
  earlier: readonly BookingResponse[],
  query: BookingCalendarQuery,
  timeZone: string,
): BookingResponse[] {
  const dayStart = Date.parse(localDateTimeToIso(query.date, "00:00", timeZone));
  return earlier.filter(
    (booking) =>
      booking.kind === "RENTAL" &&
      Date.parse(booking.endsAt) > dayStart &&
      booking.status !== "CANCELLED" &&
      booking.status !== "EXPIRED",
  );
}

export function resourcesApiQuery(locationId: string | undefined): string {
  const params = new URLSearchParams();
  if (locationId) params.set("locationId", locationId);
  params.set("status", "ACTIVE");
  params.set("page", "1");
  params.set("limit", String(BOOKINGS_PAGE_SIZE));
  return params.toString();
}
