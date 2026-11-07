import { PERMISSION_KEY } from "@banijjik/contracts";
import type { DeliveryAssignmentResponse } from "@banijjik/contracts/delivery";
import { EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { DeliveryAssignmentsScreen } from "../../../../../src/delivery/delivery-assignments-screen";
import { deliveryLabelsOf } from "../../../../../src/delivery/delivery-labels";
import { fetchBusinessResourceIfAllowed } from "../../../../../src/lib/api/server-resource";
import { getTranslator } from "../../../../../src/lib/i18n/get-translator";
import { requireOrgAccess } from "../../../../../src/shell/org-access";
import { holdsPermission } from "../../../../../src/shell/permissions";

export default async function DeliveryAssignmentsRoute({
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

  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.DELIVERY_ASSIGNMENT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }

  const response = await fetchBusinessResourceIfAllowed<{
    items: DeliveryAssignmentResponse[];
    total: number;
    hasNext: boolean;
  }>(`/orgs/${access.organization.organizationId}/delivery/assignments`);

  const assignments = response?.items ?? [];
  const labels = deliveryLabelsOf(t);
  const canRecord =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.DELIVERY_HANDOVER_RECORD);
  const canReverse =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.DELIVERY_HANDOVER_REVERSE);

  return (
    <DeliveryAssignmentsScreen
      orgSlug={orgSlug}
      organizationId={access.organization.organizationId}
      assignments={assignments}
      labels={labels}
      canRecordHandover={canRecord}
      canReverseHandover={canReverse}
    />
  );
}
