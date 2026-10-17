import { PERMISSION_KEY, type TenantModuleView } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";
import { ModuleList } from "./module-list";
import { moduleListLabelsOf, moduleSheetLabelsOf } from "./module-labels";
import { toModuleRows } from "./module-rows";

const PAGE_SIZE = 100;

/**
 * `/{orgSlug}/settings/modules`: the modules the package and the template offer, and whether each is on.
 * Only a module that allows it can be switched; today none does, so the rows are read-only.
 */
export async function ModulesPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [{ t }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.SETTINGS_SETTING_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const result = await fetchBusinessResource<TenantModuleView[]>(
    `/orgs/${organizationId}/modules?limit=${PAGE_SIZE}`,
  );
  // The API refuses a module switch unless the permission is held at every location.
  const canEdit =
    access.canWrite &&
    holdsPermissionEverywhere(permissions, PERMISSION_KEY.SETTINGS_MODULE_UPDATE);
  return (
    <PageLayout title={t("modules.title")} subtitle={t("modules.subtitle")}>
      <ModuleList
        organizationId={organizationId}
        rows={toModuleRows(result.data, canEdit, t)}
        labels={moduleListLabelsOf(t)}
        sheetLabels={moduleSheetLabelsOf(t)}
      />
    </PageLayout>
  );
}
