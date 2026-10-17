import { PERMISSION_KEY, type TermsResponse } from "@banijjik/contracts";
import { EmptyState, PageHeader } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionEverywhere } from "../shell/permissions";
import { TermList } from "./term-list";
import { termListLabelsOf, termSheetLabelsOf } from "./term-labels";
import { toTermRows } from "./term-rows";

/** `/{orgSlug}/settings/terms`: the words the app uses, the template text or the business's own, per language. */
export async function TermsPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [{ t }, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.SETTINGS_SETTING_READ)) {
    return <EmptyState message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const result = await fetchBusinessResource<TermsResponse>(`/orgs/${organizationId}/terms`);
  // The API refuses a term edit unless the permission is held at every location.
  const canEdit =
    access.canWrite && holdsPermissionEverywhere(permissions, PERMISSION_KEY.SETTINGS_TERM_UPDATE);
  return (
    <>
      <PageHeader title={t("terms.title")} />
      <p className="mb-4 text-small text-secondary">{t("terms.hint")}</p>
      <TermList
        organizationId={organizationId}
        rows={toTermRows(result.data.terms, canEdit, t)}
        labels={termListLabelsOf(t)}
        sheetLabels={termSheetLabelsOf(t)}
      />
    </>
  );
}
