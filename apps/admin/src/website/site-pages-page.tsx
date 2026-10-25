import { PERMISSION_KEY } from "@banijjik/contracts";
import type { SitePageResponse } from "@banijjik/contracts/website";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { SitePageEditor } from "./site-page-editor";

/** `/{orgSlug}/website/pages`: the six static pages. Staff who may only read see them read-only. */
export async function SitePagesPage(props: { orgSlug: string }): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t } = await getTranslator();
  const permissions = access.config.permissions;
  if (!holdsPermission(permissions, PERMISSION_KEY.WEBSITE_PAGE_READ)) {
    return <EmptyState message={t("errors.forbidden")} />;
  }
  const canEdit = holdsPermission(permissions, PERMISSION_KEY.WEBSITE_PAGE_UPDATE);
  const organizationId = access.organization.organizationId;
  const pages = await fetchBusinessResource<SitePageResponse[]>(
    `/orgs/${organizationId}/website/pages`,
  );
  return (
    <PageLayout title={t("website.pages.title")} subtitle={t("website.pages.subtitle")}>
      {pages.data.map((page) => (
        <SitePageEditor
          key={page.pageKey}
          organizationId={organizationId}
          page={page}
          canEdit={canEdit}
        />
      ))}
    </PageLayout>
  );
}
