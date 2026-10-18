import { PERMISSION_KEY, type OrganizationProfileResponse } from "@banijjik/contracts";
import { PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { API_BASE_URL } from "../config/api-base-url";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { BrandingForm } from "./branding-form";
import { brandingLabelsOf } from "./branding-labels";
import { brandingToFormState } from "./branding-state";

/**
 * `/{orgSlug}/settings/branding`: the logo, colours and tagline of the business. Any member may look at
 * it; the form is editable only with the profile permission and outside READ_ONLY (the API enforces both).
 */
export async function BrandingPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [{ t }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { organizationId } = access.organization;
  const result = await fetchBusinessResource<OrganizationProfileResponse>(
    `/orgs/${organizationId}/profile`,
  );
  const profile = result.data;
  const canEdit =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.ORGANIZATION_PROFILE_UPDATE);
  return (
    <PageLayout title={t("branding.title")} subtitle={t("branding.subtitle")}>
      <BrandingForm
        key={profile.version}
        organizationId={organizationId}
        businessName={profile.name}
        version={profile.version}
        initial={brandingToFormState(profile.branding, API_BASE_URL)}
        labels={brandingLabelsOf(t)}
        canEdit={canEdit}
      />
    </PageLayout>
  );
}
