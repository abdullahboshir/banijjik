import { callStorefront, type ClientResult } from "../api/client-api";

export interface PublicAvailabilityQuery {
  readonly offeringId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string; // YYYY-MM-DD
}

export interface PublicTimeSlot {
  readonly startsAt: string; // ISO 8601
  readonly endsAt: string; // ISO 8601
  readonly available: boolean;
  readonly resourceIds: readonly string[];
}

export interface PublicAvailabilityDay {
  readonly date: string; // YYYY-MM-DD
  readonly slots: readonly PublicTimeSlot[];
}

export interface PublicAvailabilityResponse {
  readonly offeringId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly days: readonly PublicAvailabilityDay[];
}

const MAX_AVAILABILITY_DAYS = 31;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function validateDateRange(startDate: string, endDate: string): void {
  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error("Invalid start or end date format. Expected YYYY-MM-DD.");
  }
  const daySpan = Math.ceil((endMs - startMs) / MS_PER_DAY) + 1;
  if (daySpan > MAX_AVAILABILITY_DAYS) {
    throw new Error(
      `Availability query range cannot exceed ${MAX_AVAILABILITY_DAYS} days. Requested: ${daySpan} days.`,
    );
  }
}

/**
 * Fetches real-time slot availability for a service offering variant.
 * Enforces bounded query range (<= 31 days).
 */
export async function fetchAvailability(
  organizationId: string,
  query: PublicAvailabilityQuery,
): Promise<ClientResult<PublicAvailabilityResponse>> {
  validateDateRange(query.startDate, query.endDate);

  const params = new URLSearchParams({
    offeringId: query.offeringId,
    variantId: query.variantId,
    locationId: query.locationId,
    startDate: query.startDate,
    endDate: query.endDate,
  });

  return callStorefront<PublicAvailabilityResponse>(
    "GET",
    `/orgs/${encodeURIComponent(organizationId)}/availability?${params.toString()}`,
  );
}
