import { PERMISSION_KEY } from "@banijjik/contracts";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { loadCatalogLookups } from "../catalog/catalog-lookups";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { AdjustStockForm } from "./adjust-stock-form";
import { adjustStockLabelsOf, itemPickerLabelsOf, stockLabelsOf } from "./stock-labels";
import { parseStockQuery } from "./stock-query";

/** `/{orgSlug}/catalog/adjustments`: change on-hand with a reason. */
export async function AdjustmentsPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.INVENTORY_ADJUSTMENT_CREATE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  if (!access.canWrite) {
    return <EmptyState kind="noPermission" message={t("state.readOnly")} />;
  }
  const lookups = await loadCatalogLookups(access);
  const query = parseStockQuery(searchParams);
  const locationId = query.locationId ?? lookups.locations[0]?.locationId ?? "";
  const labels = stockLabelsOf(t);
  return (
    <PageLayout
      title={labels.adjustmentsTitle}
      subtitle={labels.adjustmentsSubtitle}
      actions={
        <Link
          href={`/${orgSlug}/catalog/stock`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {labels.backToStock}
        </Link>
      }
    >
      <AdjustStockForm
        organizationId={access.organization.organizationId}
        locations={lookups.locations}
        defaultLocationId={locationId}
        labels={adjustStockLabelsOf(t)}
        pickerLabels={itemPickerLabelsOf(t)}
        onSuccess={() => undefined}
      />
    </PageLayout>
  );
}
