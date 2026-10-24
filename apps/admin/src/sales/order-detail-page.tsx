import {
  PERMISSION_KEY,
  type AuditLogSummary,
  type CallerPermissionsResponse,
  type CurrencyCode,
  type SettingsResponse,
} from "@banijjik/contracts";
import { UNIT_KEY } from "@banijjik/contracts/catalog";
import {
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_METHODS_SETTING_KEY,
  PAYMENT_REQUEST_TYPE,
  type DueItemResponse,
  type PaymentMethod,
} from "@banijjik/contracts/payment";
import {
  PAYMENT_STATUS,
  SALES_USE_PACKING_DEFAULT,
  SALES_USE_PACKING_SETTING_KEY,
  type OrderResponse,
} from "@banijjik/contracts/sales";
import { DetailHeader, EmptyState, MoneyText, StatusBadge, currencySymbolOf } from "@banijjik/ui";
import type { Locale } from "@banijjik/i18n";
import type { ReactElement } from "react";
import { loadCatalogLookups } from "../catalog/catalog-lookups";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { paymentLabelsOf } from "../payments/payment-labels";
import { requireOrgAccess } from "../shell/org-access";
import {
  holdsPermission,
  holdsPermissionAt,
  holdsPermissionEverywhere,
} from "../shell/permissions";
import { OrderDetailClient, type OrderDetailPermissions } from "./order-detail-client";
import { LinesSection, SummarySection, TotalsSection } from "./order-detail-sections";
import { OrderHistorySection } from "./order-history";
import { orderLabelsOf, orderUnitLabel, type OrderLabels } from "./order-labels";

const DUES_PAGE_LIMIT = 100;
const AUDIT_PAGE_LIMIT = 50;

function resolveAllowedMethods(
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

function resolveUsePacking(settingsResult: SettingsResponse | null | undefined): boolean {
  const value = settingsResult?.settings[SALES_USE_PACKING_SETTING_KEY]?.value;
  return typeof value === "boolean" ? value : SALES_USE_PACKING_DEFAULT;
}

/**
 * The receive sheet's amount. Without a dues row the full price is safe only for an UNPAID order;
 * for any other status it offers nothing, so the shop never takes the price twice (3.8 rule).
 */
function resolveRemainingDue(order: OrderResponse, dueItem: DueItemResponse | undefined): number {
  if (dueItem) return dueItem.due.amount;
  return order.paymentStatus === PAYMENT_STATUS.UNPAID ? order.totals.grandTotal.amount : 0;
}

function resolvePermissions(
  permissions: CallerPermissionsResponse,
  canWrite: boolean,
  locationId: string,
): OrderDetailPermissions {
  const atLocation = (key: Parameters<typeof holdsPermissionAt>[1]): boolean =>
    canWrite && holdsPermissionAt(permissions, key, locationId);
  return {
    canUpdate: atLocation(PERMISSION_KEY.SALES_ORDER_UPDATE),
    canConfirm: atLocation(PERMISSION_KEY.SALES_ORDER_CONFIRM),
    canCancel: atLocation(PERMISSION_KEY.SALES_ORDER_CANCEL),
    canReceive: atLocation(PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE),
  };
}

function hasNetPaid(order: OrderResponse): boolean {
  return (
    order.paymentStatus === PAYMENT_STATUS.PARTIAL ||
    order.paymentStatus === PAYMENT_STATUS.PAID ||
    order.paymentStatus === PAYMENT_STATUS.PARTIALLY_REFUNDED
  );
}

type OrgAccess = Awaited<ReturnType<typeof requireOrgAccess>>;

/** The reads around one order: catalog lookups, settings, its dues row and (with permission) its history. */
async function loadOrderDetailReads(access: OrgAccess, order: OrderResponse) {
  const organizationId = access.organization.organizationId;
  const canReadAudit = holdsPermissionEverywhere(
    access.config.permissions,
    PERMISSION_KEY.AUDIT_LOG_READ,
  );
  const [lookups, settingsResult, duesResult, auditResult] = await Promise.all([
    loadCatalogLookups(access),
    fetchBusinessResourceIfAllowed<SettingsResponse>(
      `/orgs/${organizationId}/settings?keys=${PAYMENT_METHODS_SETTING_KEY},${SALES_USE_PACKING_SETTING_KEY}&location=${order.locationId}`,
    ),
    order.contactId === null
      ? Promise.resolve(undefined)
      : fetchBusinessResourceIfAllowed<DueItemResponse[]>(
          `/orgs/${organizationId}/dues?contactId=${order.contactId}&requestType=${PAYMENT_REQUEST_TYPE.ORDER}&locationId=${order.locationId}&limit=${DUES_PAGE_LIMIT}`,
        ),
    canReadAudit
      ? fetchBusinessResourceIfAllowed<AuditLogSummary[]>(
          `/orgs/${organizationId}/audit-logs?entityType=order&entityId=${order.orderId}&limit=${AUDIT_PAGE_LIMIT}`,
        )
      : Promise.resolve(undefined),
  ]);
  return { lookups, settingsResult, duesResult, auditResult };
}

type Translator = Awaited<ReturnType<typeof getTranslator>>;
type OrderDetailReads = Awaited<ReturnType<typeof loadOrderDetailReads>>;

function unitLabelsOf(translator: Translator): Record<string, string> {
  const unitLabels: Record<string, string> = {};
  for (const unitKey of Object.values(UNIT_KEY)) {
    unitLabels[unitKey] = orderUnitLabel(translator, unitKey);
  }
  return unitLabels;
}

function OrderDetailClientSlot(props: {
  readonly orgSlug: string;
  readonly access: OrgAccess;
  readonly translator: Translator;
  readonly order: OrderResponse;
  readonly locationName: string;
  readonly reads: OrderDetailReads;
}): ReactElement {
  const { access, order, reads, translator } = props;
  const currency: CurrencyCode = reads.lookups.currency;
  const dueItem = reads.duesResult?.find((row) => row.requestId === order.orderId);
  return (
    <OrderDetailClient
      orgSlug={props.orgSlug}
      organizationId={access.organization.organizationId}
      order={order}
      locationName={props.locationName}
      contactName={order.contactName ?? undefined}
      remainingDueMinor={resolveRemainingDue(order, dueItem)}
      hasNetPaid={hasNetPaid(order)}
      currency={currency}
      currencySymbol={currencySymbolOf(currency)}
      allowedMethods={resolveAllowedMethods(reads.settingsResult)}
      permissions={resolvePermissions(access.config.permissions, access.canWrite, order.locationId)}
      usePacking={resolveUsePacking(reads.settingsResult)}
      modifierGroups={reads.lookups.modifierGroups}
      unitLabels={unitLabelsOf(translator)}
      locale={translator.locale}
      labels={orderLabelsOf(translator.t)}
      paymentLabels={paymentLabelsOf(translator.t)}
    />
  );
}

function OrderHeader(props: {
  readonly orgSlug: string;
  readonly order: OrderResponse;
  readonly labels: OrderLabels;
  readonly locale: Locale;
}): ReactElement {
  const { labels, order } = props;
  return (
    <DetailHeader
      title={order.orderNumber ?? labels.detail.titleFallback}
      backHref={`/${props.orgSlug}/orders`}
      backLabel={labels.detail.back}
      status={
        <StatusBadge
          requestType="ORDER"
          status={order.status}
          label={labels.status[order.status]}
        />
      }
      facts={
        <span className="font-money">
          {labels.detail.total}: <MoneyText money={order.totals.grandTotal} locale={props.locale} />
        </span>
      }
    />
  );
}

export async function OrderDetailPage(props: {
  readonly orgSlug: string;
  readonly orderId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.SALES_ORDER_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const organizationId = access.organization.organizationId;
  const { data: order } = await fetchBusinessResource<OrderResponse>(
    `/orgs/${organizationId}/orders/${props.orderId}`,
  );
  const reads = await loadOrderDetailReads(access, order);
  const labels = orderLabelsOf(t);
  const locationName =
    reads.lookups.locations.find((location) => location.locationId === order.locationId)?.name ??
    order.locationId;
  return (
    <div className="flex flex-col gap-6">
      <OrderHeader orgSlug={props.orgSlug} order={order} labels={labels} locale={locale} />
      <OrderDetailClientSlot
        orgSlug={props.orgSlug}
        access={access}
        translator={translator}
        order={order}
        locationName={locationName}
        reads={reads}
      />
      <SummarySection
        order={order}
        locationName={locationName}
        locale={locale}
        timeZone={access.timeZone}
        labels={labels}
      />
      <LinesSection order={order} labels={labels} locale={locale} />
      <TotalsSection order={order} labels={labels} locale={locale} />
      <OrderHistorySection
        entries={reads.auditResult}
        labels={labels.history}
        locale={locale}
        timeZone={access.timeZone}
      />
    </div>
  );
}
