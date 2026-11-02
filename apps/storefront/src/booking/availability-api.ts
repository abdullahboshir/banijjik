import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import { callStorefront, type ClientResult } from "../api/client-api";

export interface PublicAvailabilityQuery {
  readonly offeringId: string;
  readonly variantId: string;
  readonly locationId: string;
  readonly startDate: string;
  readonly endDate: string;
}

export interface PublicAvailabilityDay {
  readonly date: string;
  readonly slots: readonly AvailabilitySlot[];
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
 * Live free slots for one SERVICE variant. The client keeps the 31-day guard; the API omits taken
 * slots and does not send an `available` flag.
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
