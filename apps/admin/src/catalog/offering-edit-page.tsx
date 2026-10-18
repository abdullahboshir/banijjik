import { PERMISSION_KEY } from "@banijjik/contracts";
import type { OfferingResponse } from "@banijjik/contracts/catalog";
import { buttonVariants, EmptyState, PageLayout, StatusBadge } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { loadCatalogLookups } from "./catalog-lookups";
import { buildEditorProps } from "./editor-props";
import { LazyOfferingEditor } from "./lazy-offering-editor";

/** `/{orgSlug}/catalog/{offeringId}`: the form of one offering. Staff without the update permission see it read-only. */
export async function OfferingEditPage({
  orgSlug,
  offeringId,
}: {
  orgSlug: string;
  offeringId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.CATALOG_OFFERING_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [offering, lookups] = await Promise.all([
    fetchBusinessResource<OfferingResponse>(`/orgs/${organizationId}/offerings/${offeringId}`),
    loadCatalogLookups(access),
  ]);
  const editor = buildEditorProps({
    access,
    translator,
    lookups,
    kind: offering.data.kind,
    offering: offering.data,
  });
  return (
    <PageLayout
      title={offering.data.name}
      subtitle={editor.canWrite ? t("catalog.editor.kindLocked") : t("catalog.readOnly")}
      actions={
        <>
          <StatusBadge
            requestType="OFFERING"
            status={offering.data.status}
            label={t(`catalog.status.${offering.data.status}`)}
          />
          <Link href={`/${orgSlug}/catalog`} className={buttonVariants({ variant: "secondary" })}>
            {t("catalog.editor.back")}
          </Link>
        </>
      }
    >
      <LazyOfferingEditor key={offering.data.version} {...editor} />
    </PageLayout>
  );
}
