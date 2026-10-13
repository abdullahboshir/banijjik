import type { OrganizationProfileResponse } from "@banijjik/contracts";
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
