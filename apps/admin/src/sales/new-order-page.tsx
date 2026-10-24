import { PERMISSION_KEY } from "@banijjik/contracts";
import { UNIT_KEY } from "@banijjik/contracts/catalog";
import { EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCatalogLookups } from "../catalog/catalog-lookups";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { orderLabelsOf, orderUnitLabel } from "./order-labels";
import { NewOrderWorkspace } from "./new-order-workspace";

/** `/{orgSlug}/orders/new`: the new-order screen for a caller who may create orders. */
export async function NewOrderPage(props: { readonly orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  const canCreate =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.SALES_ORDER_CREATE);
  if (!canCreate) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const lookups = await loadCatalogLookups(access);
  const unitLabels: Record<string, string> = {};
  for (const unitKey of Object.values(UNIT_KEY)) {
    unitLabels[unitKey] = orderUnitLabel(translator, unitKey);
  }
  const labels = orderLabelsOf(t);
  return (
    <NewOrderWorkspace
      orgSlug={props.orgSlug}
      organizationId={access.organization.organizationId}
      locations={lookups.locations}
      modifierGroups={lookups.modifierGroups}
      unitLabels={unitLabels}
      currency={lookups.currency}
      locale={locale}
      labels={labels}
    />
  );
}
