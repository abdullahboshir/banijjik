import "server-only";
import { BOOKING_SLOT_STEP_MINUTES_SETTING_KEY } from "@banijjik/contracts/booking";
import { OFFERING_KIND } from "@banijjik/contracts";
import type { LocationResponse } from "@banijjik/contracts";
import type {
  OfferingListItem,
  OfferingResponse,
  ServiceDetails,
} from "@banijjik/contracts/catalog";
import { BOOKING_SLOT_STEP_MINUTES_DEFAULT } from "@banijjik/contracts/booking";
import type { SettingsResponse } from "@banijjik/contracts";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";

const LOOKUP_LIMIT = 100;

export async function loadBookingLookups(access: OrgAccess): Promise<{
  locations: LocationResponse[];
  slotStepMinutes: number;
}> {
  const organizationId = access.organization.organizationId;
  const [locations, settings] = await Promise.all([
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOOKUP_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<SettingsResponse>(`/orgs/${organizationId}/settings`),
  ]);
  const raw = settings?.settings[BOOKING_SLOT_STEP_MINUTES_SETTING_KEY]?.value;
  const slotStepMinutes =
    typeof raw === "number" && Number.isInteger(raw) ? raw : BOOKING_SLOT_STEP_MINUTES_DEFAULT;
  return { locations: locations ?? [], slotStepMinutes };
}

export async function loadBookableServices(access: OrgAccess): Promise<OfferingResponse[]> {
  const organizationId = access.organization.organizationId;
  const { data: list } = await fetchBusinessResource<OfferingListItem[]>(
    `/orgs/${organizationId}/offerings?kind=${OFFERING_KIND.SERVICE}&status=ACTIVE&limit=${LOOKUP_LIMIT}`,
  );
  const serviceIds = list.map((row) => row.offeringId);
  const offerings = await Promise.all(
    serviceIds.map(async (offeringId) => {
      const { data } = await fetchBusinessResource<OfferingResponse>(
        `/orgs/${organizationId}/offerings/${offeringId}`,
      );
      return data;
    }),
  );
  return offerings.filter((offering) => {
    if (offering.kind !== OFFERING_KIND.SERVICE) return false;
    const details = offering.kindDetails as ServiceDetails;
    return details.bookingMode === "SLOT" && details.requiresResource;
  });
}
