import { PERMISSION_KEY } from "@banijjik/contracts";
import { currencySymbolOf, EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCurrency } from "../catalog/catalog-lookups";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { creditPackLabelsOf } from "./credit-labels";
import type { CreditPackPage } from "./credit-api";
import { CreditPacksManager } from "./packs-manager";

const PACK_PAGE_LIMIT = 100;

/** `/{orgSlug}/credit/packs`: the prepaid packs staff sell (M.4; selling itself is M.5). */
export async function CreditPacksPage({ orgSlug }: { orgSlug: string }): Promise<ReactElement> {
  const [translator, access] = await Promise.all([getTranslator(), requireOrgAccess(orgSlug)]);
  const { t, locale } = translator;
  const { permissions } = access.config;
  if (!holdsPermission(permissions, PERMISSION_KEY.CREDIT_PACK_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const { organizationId } = access.organization;
  const [packs, currency] = await Promise.all([
    fetchBusinessResource<CreditPackPage>(
      `/orgs/${organizationId}/credit/packs?limit=${PACK_PAGE_LIMIT}`,
    ),
    loadCurrency(access),
  ]);
  const can = (key: Parameters<typeof holdsPermission>[1]): boolean =>
    access.canWrite && holdsPermission(permissions, key);
  return (
    <PageLayout
      title={t("credit.packs.title")}
      subtitle={access.canWrite ? t("credit.packs.subtitle") : t("credit.packs.readOnly")}
    >
      <CreditPacksManager
        organizationId={organizationId}
        packs={packs.data.items}
        currency={currency}
        currencySymbol={currencySymbolOf(currency)}
        locale={locale}
        labels={creditPackLabelsOf(t)}
        canCreate={can(PERMISSION_KEY.CREDIT_PACK_UPDATE)}
        canUpdate={can(PERMISSION_KEY.CREDIT_PACK_UPDATE)}
        canArchive={can(PERMISSION_KEY.CREDIT_PACK_UPDATE)}
      />
    </PageLayout>
  );
}
