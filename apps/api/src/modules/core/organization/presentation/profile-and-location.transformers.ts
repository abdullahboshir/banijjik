import type { LocationResponse, OrganizationProfileResponse } from "@banijjik/contracts";
import type { Location } from "../domain/location.entity.js";
import type { Organization } from "../domain/organization.entity.js";

export function toProfileResponse(organization: Organization): OrganizationProfileResponse {
  return {
    organizationId: organization.organizationId,
    slug: organization.slug,
    name: organization.name,
    defaultLocale: organization.defaultLocale,
    timezone: organization.timezone,
    countryCode: organization.countryCode,
    currencyCode: organization.currencyCode,
    profile: { ...organization.profile },
    version: organization.version,
  };
}

export function toLocationResponse(location: Location): LocationResponse {
  return {
    locationId: location.locationId,
    name: location.name,
    locationType: location.locationType,
    isDefault: location.isDefault,
    status: location.status,
    version: location.version,
    ...(location.address === undefined ? {} : { address: { ...location.address } }),
    ...(location.phoneE164 === undefined ? {} : { phoneE164: location.phoneE164 }),
    ...(location.timezone === undefined ? {} : { timezone: location.timezone }),
  };
}
