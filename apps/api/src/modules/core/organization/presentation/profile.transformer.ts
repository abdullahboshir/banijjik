import type { OrganizationProfileResponse } from "@banijjik/contracts";
import type { ProfileView } from "../application/custom-field-view.js";

export function toProfileResponse(view: ProfileView): OrganizationProfileResponse {
  const { organization } = view;
  return {
    organizationId: organization.organizationId,
    slug: organization.slug,
    name: organization.name,
    defaultLocale: organization.defaultLocale,
    timezone: organization.timezone,
    countryCode: organization.countryCode,
    currencyCode: organization.currencyCode,
    profile: { ...organization.profile },
    customFields: view.customFields,
    version: organization.version,
  };
}
