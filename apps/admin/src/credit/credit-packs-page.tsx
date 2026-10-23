import { PERMISSION_KEY, type SettingsResponse } from "@banijjik/contracts";
import { CREDIT_RULE_KEY, type CreditPaymentMethodSetting } from "@banijjik/contracts/credit";
import { currencySymbolOf, EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCurrency } from "../catalog/catalog-lookups";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { creditPackLabelsOf, creditPaymentMethodsLabelsOf } from "./credit-labels";
import type { CreditPackPage } from "./credit-api";
import { CreditPaymentMethodsSection } from "./credit-payment-methods-section";
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
  const [packs, currency, settings] = await Promise.all([
    fetchBusinessResource<CreditPackPage>(
      `/orgs/${organizationId}/credit/packs?limit=${PACK_PAGE_LIMIT}`,
    ),
    loadCurrency(access),
    fetchBusinessResourceIfAllowed<SettingsResponse>(
      `/orgs/${organizationId}/settings?keys=${CREDIT_RULE_KEY.PAYMENT_METHODS}`,
    ),
  ]);
  const can = (key: Parameters<typeof holdsPermission>[1]): boolean =>
    access.canWrite && holdsPermission(permissions, key);
  const paymentSetting = settings?.settings[CREDIT_RULE_KEY.PAYMENT_METHODS];
  const paymentMethods = (paymentSetting?.value ?? []) as CreditPaymentMethodSetting[];
  const paymentVersion = paymentSetting?.version;
  const canUpdateMethods = can(PERMISSION_KEY.SETTINGS_SETTING_UPDATE);

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
      {settings ? (
        <CreditPaymentMethodsSection
          organizationId={organizationId}
          methods={paymentMethods}
          version={paymentVersion}
          canUpdate={canUpdateMethods}
          labels={creditPaymentMethodsLabelsOf(t)}
        />
      ) : null}
    </PageLayout>
  );
}
