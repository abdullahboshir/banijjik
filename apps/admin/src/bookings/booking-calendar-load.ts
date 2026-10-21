import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { BookingResponse, ResourceResponse } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import { fetchBusinessResource } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { loadBookableServices, loadBookingLookups } from "./booking-lookups";
import {
  bookingsApiQuery,
  parseBookingCalendarQuery,
  resourcesApiQuery,
  type BookingCalendarQuery,
} from "./booking-query";

export interface BookingCalendarLoadResult {
  query: BookingCalendarQuery & { locationId: string };
  organizationId: string;
  bookings: BookingResponse[];
  resources: ResourceResponse[];
  offerings: OfferingResponse[];
  slotStepMinutes: number;
  canCreate: boolean;
  noLocation: boolean;
  locations: readonly LocationResponse[];
}

export async function loadBookingCalendarData(input: {
  searchParams: Record<string, string | string[] | undefined>;
  access: OrgAccess;
}): Promise<BookingCalendarLoadResult> {
  const query = parseBookingCalendarQuery(input.searchParams, input.access.timeZone);
  const lookups = await loadBookingLookups(input.access);
  const organizationId = input.access.organization.organizationId;
  const locationId = query.locationId ?? lookups.locations[0]?.locationId;
  if (locationId === undefined) {
    return {
      query: { ...query, locationId: "" },
      organizationId,
      bookings: [],
      resources: [],
      offerings: [],
      slotStepMinutes: lookups.slotStepMinutes,
      canCreate: false,
      noLocation: true,
      locations: lookups.locations,
    };
  }
  const resolvedQuery = { ...query, locationId };
  const [bookingsResult, resourcesResult, offerings] = await Promise.all([
    fetchBusinessResource<BookingResponse[]>(bookingsApiQuery(organizationId, resolvedQuery)),
    fetchBusinessResource<ResourceResponse[]>(
      `/orgs/${organizationId}/resources?${resourcesApiQuery(locationId)}`,
    ),
    loadBookableServices(input.access),
  ]);
  const canCreate =
    input.access.canWrite &&
    holdsPermission(input.access.config.permissions, PERMISSION_KEY.BOOKING_BOOKING_CREATE);
  return {
    query: resolvedQuery,
    organizationId,
    bookings: bookingsResult.data,
    resources: resourcesResult.data,
    offerings,
    slotStepMinutes: lookups.slotStepMinutes,
    canCreate,
    noLocation: false,
    locations: lookups.locations,
  };
}
