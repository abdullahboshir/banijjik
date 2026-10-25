import { PERMISSION_KEY } from "@banijjik/contracts";
import { EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCurrency } from "../catalog/catalog-lookups";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { posLabelsOf } from "./pos-labels";
import { PosTerminal } from "./pos-terminal";

/**
 * `/{orgSlug}/pos`: the till. It is a full-screen route (no shell), so the access check runs here
 * as it does in the shell layout. The device, not the page, decides the location (plan 3.9 decision 2).
 */
export async function PosPage(props: { readonly orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const canSell =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.POS_SESSION_OPEN) &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.POS_SALE_CREATE);
  if (!canSell) {
    return <EmptyState kind="noPermission" message={translator.t("state.permissionDenied")} />;
  }
  const currency = await loadCurrency(access);
  return (
    <PosTerminal
      organizationId={access.organization.organizationId}
      currency={currency}
      labels={posLabelsOf(translator)}
    />
  );
}
