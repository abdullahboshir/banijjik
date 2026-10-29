import { ERROR_HTTP_STATUS, PERMISSION_KEY } from "@banijjik/contracts";
import type { SiteDomainListResponse } from "@banijjik/contracts/website";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { requireSession } from "../auth/session-data";
import { ApiError } from "../lib/api/api-error";
import { serverApiFetch } from "../lib/api/server-api-fetch";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermissionEverywhere } from "../shell/permissions";
import { LazyDomainWizard } from "./domain-wizard-lazy";

const LIST_LIMIT = 100;

/**
 * `GET /website/domains` is 404 until a Site exists (4.5). Do not use `fetchBusinessResource`:
 * that maps 404 to the Next not-found page.
 */
function loadDomainList(organizationId: string): Promise<SiteDomainListResponse | undefined> {
  return requireSession(async () => {
    try {
      const result = await serverApiFetch<SiteDomainListResponse>(
        `/orgs/${organizationId}/website/domains?limit=${LIST_LIMIT}`,
      );
      return result.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === ERROR_HTTP_STATUS.NOT_FOUND) {
        return undefined;
      }
      throw error;
    }
  });
}

/** `/{orgSlug}/website/domains`: add a hostname, copy DNS records, verify, remove, pick canonical. */
export async function DomainsPage(props: { orgSlug: string }): Promise<ReactElement> {
  const access = await requireOrgAccess(props.orgSlug);
  const { t } = await getTranslator();
  const permissions = access.config.permissions;
  if (!holdsPermissionEverywhere(permissions, PERMISSION_KEY.WEBSITE_DOMAIN_MANAGE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const organizationId = access.organization.organizationId;
  const listed = await loadDomainList(organizationId);
  if (listed === undefined) {
    return (
      <PageLayout title={t("website.domains.title")} subtitle={t("website.domains.subtitle")}>
        <EmptyState message={t("website.domains.noSite")} />
      </PageLayout>
    );
  }
  return (
    <PageLayout title={t("website.domains.title")} subtitle={t("website.domains.subtitle")}>
      <LazyDomainWizard
        organizationId={organizationId}
        initialItems={listed.items}
        canWrite={access.canWrite}
      />
    </PageLayout>
  );
}
