import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { ResourceResponse } from "@banijjik/contracts/booking";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import { loadBookableServices } from "../bookings/booking-lookups";
import { resourcesApiQuery } from "../bookings/booking-query";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import type { OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";

const LOOKUP_LIMIT = 100;

export interface ResourceListLoadResult {
  organizationId: string;
  locations: LocationResponse[];
  locationId: string | undefined;
  resources: ResourceResponse[];
  offerings: OfferingResponse[];
  canCreate: boolean;
}

export async function loadResourceListPage(access: OrgAccess): Promise<ResourceListLoadResult> {
  const organizationId = access.organization.organizationId;
  const locations =
    (await fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOOKUP_LIMIT}`,
    )) ?? [];
  const locationId = locations[0]?.locationId;
  const canCreate =
    access.canWrite &&
    locationId !== undefined &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKING_RESOURCE_CREATE);
  const resources =
    locationId === undefined
      ? []
      : (
          await fetchBusinessResource<ResourceResponse[]>(
            `/orgs/${organizationId}/resources?${resourcesApiQuery(locationId)}`,
          )
        ).data;
  const offerings = await loadBookableServices(access);
  return { organizationId, locations, locationId, resources, offerings, canCreate };
}
