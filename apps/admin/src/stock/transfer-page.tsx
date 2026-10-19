import { PERMISSION_KEY } from "@banijjik/contracts";
import { buttonVariants, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { loadCatalogLookups } from "../catalog/catalog-lookups";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { itemPickerLabelsOf, stockLabelsOf, transferLabelsOf } from "./stock-labels";
import { parseStockQuery } from "./stock-query";
import { TransferForm } from "./transfer-form";

/** `/{orgSlug}/catalog/transfers`: move stock between branches in one step. */
export async function TransferPage({
  orgSlug,
  searchParams,
}: {
  orgSlug: string;
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.INVENTORY_TRANSFER_CREATE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  if (!access.canWrite) {
    return <EmptyState kind="noPermission" message={t("state.readOnly")} />;
  }
  const lookups = await loadCatalogLookups(access);
  const query = parseStockQuery(searchParams);
  const defaultFrom = query.locationId ?? lookups.locations[0]?.locationId ?? "";
  const labels = stockLabelsOf(t);
  return (
    <PageLayout
      title={labels.transfersTitle}
      subtitle={labels.transfersSubtitle}
      actions={
        <Link
          href={`/${orgSlug}/catalog/stock`}
          className={buttonVariants({ variant: "secondary" })}
        >
          {labels.backToStock}
        </Link>
      }
    >
      <TransferForm
        organizationId={access.organization.organizationId}
        locations={lookups.locations}
        defaultFromLocationId={defaultFrom}
        labels={transferLabelsOf(t)}
        pickerLabels={itemPickerLabelsOf(t)}
      />
    </PageLayout>
  );
}
