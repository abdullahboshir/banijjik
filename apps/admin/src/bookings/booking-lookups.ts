import "server-only";
import { BOOKING_SLOT_STEP_MINUTES_SETTING_KEY } from "@banijjik/contracts/booking";
import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
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

async function loadActiveOfferings(
  access: OrgAccess,
  kind: OfferingKind,
): Promise<OfferingResponse[]> {
  const organizationId = access.organization.organizationId;
  const { data: list } = await fetchBusinessResource<OfferingListItem[]>(
    `/orgs/${organizationId}/offerings?kind=${kind}&status=ACTIVE&limit=${LOOKUP_LIMIT}`,
  );
  const offerings = await Promise.all(
    list.map(async (row) => {
      const { data } = await fetchBusinessResource<OfferingResponse>(
        `/orgs/${organizationId}/offerings/${row.offeringId}`,
      );
      return data;
    }),
  );
  return offerings.filter((offering) => offering.kind === kind);
}

export async function loadBookableServices(access: OrgAccess): Promise<OfferingResponse[]> {
  const services = await loadActiveOfferings(access, OFFERING_KIND.SERVICE);
  return services.filter((offering) => {
    const details = offering.kindDetails as ServiceDetails;
    return details.bookingMode === "SLOT" && details.requiresResource;
  });
}

/** Rentals and events book through the same sheet as services; each has its own mode there. */
export async function loadRentalAndEventOfferings(access: OrgAccess): Promise<OfferingResponse[]> {
  const [rentals, events] = await Promise.all([
    loadActiveOfferings(access, OFFERING_KIND.RENTAL),
    loadActiveOfferings(access, OFFERING_KIND.EVENT),
  ]);
  return [...rentals, ...events];
}

export function loadEventOfferings(access: OrgAccess): Promise<OfferingResponse[]> {
  return loadActiveOfferings(access, OFFERING_KIND.EVENT);
}
