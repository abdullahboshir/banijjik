import { PERMISSION_KEY } from "@banijjik/contracts";
import type { DeliveryZone } from "@banijjik/contracts/sales/delivery";
import { EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCurrency } from "../../../../../src/catalog/catalog-lookups";
import { fetchBusinessResource } from "../../../../../src/lib/api/server-resource";
import { getTranslator } from "../../../../../src/lib/i18n/get-translator";
import { deliveryZoneLabelsOf } from "../../../../../src/sales/delivery-zone-labels";
import { DeliveryZonesScreen } from "../../../../../src/sales/delivery-zones-screen";
import { requireOrgAccess } from "../../../../../src/shell/org-access";
import { holdsPermission } from "../../../../../src/shell/permissions";

const PAGE_LIMIT = 100;

export default async function SettingsDeliveryZonesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t, locale } = translator;
  const { permissions } = access.config;

  if (!holdsPermission(permissions, PERMISSION_KEY.SALES_DELIVERY_ZONE_MANAGE)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }

  const { organizationId } = access.organization;
  const [listed, currency] = await Promise.all([
    fetchBusinessResource<DeliveryZone[]>(
      `/orgs/${organizationId}/sales/delivery-zones?limit=${PAGE_LIMIT}`,
    ),
    loadCurrency(access),
  ]);

  const labels = deliveryZoneLabelsOf(t);
  const canManage =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.SALES_DELIVERY_ZONE_MANAGE);

  return (
    <DeliveryZonesScreen
      orgSlug={orgSlug}
      organizationId={organizationId}
      initialZones={listed.data}
      currency={currency}
      labels={labels}
      locale={locale}
      canManage={canManage}
    />
  );
}
