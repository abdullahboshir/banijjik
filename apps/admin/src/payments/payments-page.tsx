import { PERMISSION_KEY, type LocationResponse, type SettingsResponse } from "@banijjik/contracts";
import {
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_METHODS_SETTING_KEY,
  type PaymentMethod,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import { currencySymbolOf, EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCurrency } from "../catalog/catalog-lookups";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import type { OrgAccess } from "../shell/org-access";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { paymentLabelsOf } from "./payment-labels";
import { PaymentMethodsSection } from "./payment-methods-section";
import { parsePaymentsQuery, paymentsApiQuery, type PaymentsQuery } from "./payment-query";
import { PaymentsManager } from "./payments-manager";

const LOCATION_LIMIT = 100;

export interface PaymentsPageProps {
  readonly orgSlug: string;
  readonly searchParams?: Record<string, string | string[] | undefined> | undefined;
}

function resolvePaymentMethods(
  settingsResult: SettingsResponse | null | undefined,
): readonly PaymentMethod[] {
  const paymentSetting = settingsResult?.settings[PAYMENT_METHODS_SETTING_KEY];
  if (
    paymentSetting?.value &&
    Array.isArray(paymentSetting.value) &&
    paymentSetting.value.length > 0
  ) {
    return paymentSetting.value as readonly PaymentMethod[];
  }
  return PAYMENT_METHODS_DEFAULT;
}

async function loadPageResources(access: OrgAccess, query: PaymentsQuery) {
  const { organizationId } = access.organization;
  const apiQueryStr = paymentsApiQuery(query);
  const [paymentsResult, currency, locationsResult, settingsResult] = await Promise.all([
    fetchBusinessResource<readonly PaymentResponse[], { total?: number }>(
      `/orgs/${organizationId}/payments?${apiQueryStr}`,
    ),
    loadCurrency(access),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=${LOCATION_LIMIT}`,
    ),
    fetchBusinessResourceIfAllowed<SettingsResponse>(
      `/orgs/${organizationId}/settings?keys=${PAYMENT_METHODS_SETTING_KEY}`,
    ),
  ]);
  const total = paymentsResult.meta?.total ?? paymentsResult.data.length;
  const locations = (locationsResult ?? []).map((loc) => ({
    locationId: loc.locationId,
    name: loc.name,
  }));
  return {
    payments: paymentsResult.data,
    total,
    currency,
    locations,
    settingsResult,
    allowedMethods: resolvePaymentMethods(settingsResult),
  };
}

export async function PaymentsPage(props: PaymentsPageProps): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  const { permissions } = access.config;

  if (!holdsPermission(permissions, PERMISSION_KEY.PAYMENT_PAYMENT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }

  const query = parsePaymentsQuery(props.searchParams ?? {});
  const data = await loadPageResources(access, query);
  const { organizationId } = access.organization;

  const canReceive =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE);
  const canUpdateSettings =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.SETTINGS_SETTING_UPDATE);
  const labels = paymentLabelsOf(t);
  const basePath = `/${props.orgSlug}/payments`;
  const duesPath = `/${props.orgSlug}/payments/dues`;
  const subtitle = access.canWrite
    ? labels.subtitle.replace("{count}", String(data.total))
    : labels.readOnly;
  const paymentSetting = data.settingsResult?.settings[PAYMENT_METHODS_SETTING_KEY];

  return (
    <PageLayout title={labels.title} subtitle={subtitle}>
      <PaymentsManager
        organizationId={organizationId}
        orgSlug={props.orgSlug}
        payments={data.payments}
        total={data.total}
        query={query}
        basePath={basePath}
        duesPath={duesPath}
        currency={data.currency}
        currencySymbol={currencySymbolOf(data.currency)}
        allowedMethods={data.allowedMethods}
        locations={data.locations}
        canReceive={canReceive}
        locale={locale}
        labels={labels}
      />
      {data.settingsResult ? (
        <PaymentMethodsSection
          organizationId={organizationId}
          methods={data.allowedMethods}
          version={paymentSetting?.version}
          canUpdate={canUpdateSettings}
          labels={{
            ...labels.settings,
            methodLabels: labels.method,
          }}
        />
      ) : null}
    </PageLayout>
  );
}
