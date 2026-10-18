import { PERMISSION_KEY } from "@banijjik/contracts";
import type { ModifierGroupResponse } from "@banijjik/contracts/catalog";
import { buttonVariants, currencySymbolOf, EmptyState, PageLayout } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { AddOnsManager } from "./add-ons-manager";
import { loadCurrency } from "./catalog-lookups";
import { addOnLabelsOf } from "./manager-labels";

const GROUP_PAGE_LIMIT = 100;

/** `/{orgSlug}/catalog/add-ons`: the add-on groups and their options with price deltas. */
export async function AddOnsPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.CATALOG_MODIFIER_GROUP_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [groups, currency] = await Promise.all([
    fetchBusinessResource<ModifierGroupResponse[]>(
      `/orgs/${organizationId}/modifier-groups?limit=${GROUP_PAGE_LIMIT}`,
    ),
    loadCurrency(access),
  ]);
  const can = (key: Parameters<typeof holdsPermission>[1]): boolean =>
    access.canWrite && holdsPermission(permissions, key);
  return (
    <PageLayout
      title={t("catalog.addOns.title")}
      subtitle={access.canWrite ? t("catalog.addOns.subtitle") : t("catalog.addOns.readOnly")}
      actions={
        <Link href={`/${orgSlug}/catalog`} className={buttonVariants({ variant: "secondary" })}>
          {t("catalog.editor.back")}
        </Link>
      }
    >
      <AddOnsManager
        organizationId={organizationId}
        groups={groups.data}
        currency={currency}
        currencySymbol={currencySymbolOf(currency)}
        labels={addOnLabelsOf(t)}
        canCreate={can(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_CREATE)}
        canUpdate={can(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_UPDATE)}
        canArchive={can(PERMISSION_KEY.CATALOG_MODIFIER_GROUP_ARCHIVE)}
      />
    </PageLayout>
  );
}
