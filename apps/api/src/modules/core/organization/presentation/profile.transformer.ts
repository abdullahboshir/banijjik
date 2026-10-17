import type { OrganizationProfileResponse } from "@banijjik/contracts";
import { publicFilePath } from "@banijjik/contracts/file";
import type { ProfileView } from "../application/custom-field-view.js";
import type { OrganizationBranding } from "../domain/organization.entity.js";

/** The branding with the logo's public address (the `medium` variant), when a logo is set. */
function toBrandingResponse(
  branding: OrganizationBranding,
): OrganizationProfileResponse["branding"] {
  const { logoFileId } = branding;
  return {
    ...branding,
    ...(logoFileId === undefined ? {} : { logoUrl: publicFilePath(logoFileId, "medium") }),
  };
}

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
    branding: toBrandingResponse(organization.branding),
    version: organization.version,
  };
}
