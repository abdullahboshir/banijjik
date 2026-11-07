import { PERMISSION_KEY } from "@banijjik/contracts";
import type { ConsignmentResponse } from "@banijjik/contracts/courier";
import { EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { CourierConsignmentsScreen } from "../../../../../src/courier/courier-consignments-screen";
import { courierLabelsOf } from "../../../../../src/courier/courier-labels";
import { fetchBusinessResourceIfAllowed } from "../../../../../src/lib/api/server-resource";
import { getTranslator } from "../../../../../src/lib/i18n/get-translator";
import { requireOrgAccess } from "../../../../../src/shell/org-access";
import { holdsPermission } from "../../../../../src/shell/permissions";

export default async function CourierConsignmentsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(orgSlug),
  ]);
  const { t } = translator;

  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.COURIER_CONSIGNMENT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }

  const consignments =
    (await fetchBusinessResourceIfAllowed<ConsignmentResponse[]>(
      `/orgs/${access.organization.organizationId}/courier/consignments`,
    )) ?? [];

  const labels = courierLabelsOf(t);
  const canRecord =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.COURIER_SETTLEMENT_RECORD);
  const canReverse =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.COURIER_SETTLEMENT_REVERSE);

  return (
    <CourierConsignmentsScreen
      orgSlug={orgSlug}
      organizationId={access.organization.organizationId}
      consignments={consignments}
      labels={labels}
      canRecordSettlement={canRecord}
      canReverseSettlement={canReverse}
    />
  );
}
