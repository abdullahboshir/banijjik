import { termLabel } from "@banijjik/web-client";
import { PERMISSION_KEY } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ResourceFormButton } from "./resource-form-button";
import { loadResourceListPage } from "./resource-list-page-load";
import { resourceListLabels } from "./resource-list-labels";
import { ResourceList } from "./resource-list";

export async function ResourceListPage(props: {
  readonly orgSlug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  void props.searchParams;
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKING_RESOURCE_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const loaded = await loadResourceListPage(access);
  const labels = resourceListLabels({ t, locale, access });
  const resourceTypes = (access.config.resourceTypes ?? []).map((type) => ({
    value: type.resourceTypeKey,
    label: termLabel(access.config.terms, type.termKey, { locale, fallback: type.resourceTypeKey }),
  }));
  const resourceTypeKey = resourceTypes[0]?.value;
  return (
    <PageLayout
      title={labels.resourceTerm}
      subtitle={t("resources.list.subtitle")}
      actions={
        loaded.canCreate && loaded.locationId !== undefined && resourceTypeKey !== undefined ? (
          <ResourceFormButton
            label={labels.add}
            sheetProps={{
              organizationId: loaded.organizationId,
              locationId: loaded.locationId,
              resourceTypeKey,
              resourceTypes,
              resourceTypeLabel: labels.list.type,
              offerings: loaded.offerings,
              labels: labels.sheet,
            }}
          />
        ) : null
      }
    >
      {loaded.resources.length === 0 ? (
        <EmptyState kind="none" message={labels.list.empty} />
      ) : (
        <ResourceList
          orgSlug={props.orgSlug}
          organizationId={loaded.organizationId}
          resources={loaded.resources}
          offerings={loaded.offerings}
          labels={labels.list}
          sheetLabels={labels.sheet}
        />
      )}
    </PageLayout>
  );
}
