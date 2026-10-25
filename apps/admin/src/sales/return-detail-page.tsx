import { PERMISSION_KEY, type SettingsResponse } from "@banijjik/contracts";
import {
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_METHODS_SETTING_KEY,
  type PaymentMethod,
} from "@banijjik/contracts/payment";
import { SALES_RETURN_STATUS, type SalesReturnResponse } from "@banijjik/contracts/sales";
import { DetailHeader, EmptyState, MoneyText, PageSection } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement, ReactNode } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { paymentLabelsOf } from "../payments/payment-labels";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission, holdsPermissionAt } from "../shell/permissions";
import { orderLabelsOf } from "./order-labels";
import { ReturnActions } from "./return-actions";
import { returnLabelsOf, type ReturnLabels } from "./return-labels";

function allowedMethodsOf(settings: SettingsResponse | null | undefined): readonly PaymentMethod[] {
  const value = settings?.settings[PAYMENT_METHODS_SETTING_KEY]?.value;
  return Array.isArray(value) && value.length > 0
    ? (value as readonly PaymentMethod[])
    : PAYMENT_METHODS_DEFAULT;
}

function SummaryItem(props: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <div>
      <dt className="text-caption text-muted">{props.label}</dt>
      <dd className="text-body">{props.children}</dd>
    </div>
  );
}

function ReturnSummary(props: {
  readonly orgSlug: string;
  readonly salesReturn: SalesReturnResponse;
  readonly labels: ReturnLabels;
  readonly locale: "bn" | "en";
}): ReactElement {
  const { salesReturn, labels, locale } = props;
  const refundNone = salesReturn.refund.amount.amount === 0;
  return (
    <PageSection title={labels.detail.title}>
      <dl className="grid gap-3 sm:grid-cols-2">
        <SummaryItem label={labels.detail.order}>
          <Link
            href={`/${props.orgSlug}/orders/${salesReturn.orderId}`}
            className="inline-flex min-h-11 items-center text-brand underline"
          >
            {labels.detail.openOrder}
          </Link>
        </SummaryItem>
        <SummaryItem label={labels.list.date}>{salesReturn.businessDate}</SummaryItem>
        <SummaryItem label={labels.detail.value}>
          <MoneyText money={salesReturn.value} locale={locale} />
        </SummaryItem>
        <SummaryItem label={labels.detail.dueReduced}>
          <MoneyText money={salesReturn.dueReduced} locale={locale} />
        </SummaryItem>
        <SummaryItem label={labels.detail.refund}>
          {refundNone ? (
            labels.detail.refundNone
          ) : (
            <MoneyText money={salesReturn.refund.amount} locale={locale} />
          )}
        </SummaryItem>
        <SummaryItem label={labels.detail.reason}>
          {labels.reasons[salesReturn.reasonKey]}
        </SummaryItem>
        {salesReturn.note === null ? null : (
          <div className="sm:col-span-2">
            <dt className="text-caption text-muted">{labels.detail.note}</dt>
            <dd className="text-body">{salesReturn.note}</dd>
          </div>
        )}
      </dl>
    </PageSection>
  );
}

function ReturnLines(props: {
  readonly salesReturn: SalesReturnResponse;
  readonly labels: ReturnLabels;
  readonly locale: "bn" | "en";
}): ReactElement {
  const { salesReturn, labels } = props;
  return (
    <PageSection title={labels.detail.lines}>
      <ul className="flex flex-col gap-3">
        {salesReturn.lines.map((line) => (
          <li
            key={line.orderLineId}
            className="flex flex-col gap-1 rounded-lg border border-border p-4"
          >
            <span className="text-body font-medium text-primary">{line.nameSnapshot}</span>
            <span className="text-caption text-secondary">
              {labels.detail.quantity} <span className="font-money">{line.quantity}</span> ·{" "}
              {labels.dispositions[line.disposition]}
            </span>
            <MoneyText money={line.value} locale={props.locale} />
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

function ReversalNotice(props: {
  readonly salesReturn: SalesReturnResponse;
  readonly labels: ReturnLabels;
  readonly locale: "bn" | "en";
}): ReactElement | null {
  const { reversal } = props.salesReturn;
  if (reversal === null) return null;
  return (
    <PageSection title={props.labels.statuses[SALES_RETURN_STATUS.REVERSED]}>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-caption text-muted">{props.labels.detail.reversedAt}</dt>
          <dd className="text-body">
            {new Date(reversal.reversedAt).toLocaleDateString(
              props.locale === "bn" ? "bn-BD" : "en-GB",
            )}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">{props.labels.detail.reversalReason}</dt>
          <dd className="text-body">
            {props.labels.reverseReasons[reversal.reasonKey] ?? reversal.reasonKey}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-muted">{props.labels.detail.payback}</dt>
          <dd className="text-body">
            {reversal.paybackPaymentId === null
              ? props.labels.detail.paybackNone
              : props.labels.detail.payback}
          </dd>
        </div>
      </dl>
    </PageSection>
  );
}

/** The payment methods a payback can use; read only when the user may reverse this return. */
function reverseSettingsOf(
  organizationId: string,
  salesReturn: SalesReturnResponse,
  canReverse: boolean,
): Promise<SettingsResponse | null | undefined> {
  if (!canReverse) return Promise.resolve(undefined);
  return fetchBusinessResourceIfAllowed<SettingsResponse>(
    `/orgs/${organizationId}/settings?keys=${PAYMENT_METHODS_SETTING_KEY}&location=${salesReturn.locationId}`,
  );
}

/** One return: its summary, its goods, the reversal if it was reversed, and the reverse action. */
export async function ReturnDetailPage(props: {
  readonly orgSlug: string;
  readonly salesReturnId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.SALES_RETURN_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const organizationId = access.organization.organizationId;
  const { data: salesReturn } = await fetchBusinessResource<SalesReturnResponse>(
    `/orgs/${organizationId}/sales/returns/${props.salesReturnId}`,
  );
  const labels = returnLabelsOf(t);
  const canReverse =
    access.canWrite &&
    holdsPermissionAt(
      access.config.permissions,
      PERMISSION_KEY.SALES_RETURN_REVERSE,
      salesReturn.locationId,
    );
  const settings = await reverseSettingsOf(organizationId, salesReturn, canReverse);
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={`${labels.detail.title} ${salesReturn.salesReturnNumber}`}
        backHref={`/${props.orgSlug}/returns`}
        backLabel={labels.detail.back}
        status={
          <span className="rounded-full bg-surface px-3 py-1 text-caption">
            {labels.statuses[salesReturn.status]}
          </span>
        }
      />
      <ReturnSummary
        orgSlug={props.orgSlug}
        salesReturn={salesReturn}
        labels={labels}
        locale={locale}
      />
      <ReturnLines salesReturn={salesReturn} labels={labels} locale={locale} />
      <ReversalNotice salesReturn={salesReturn} labels={labels} locale={locale} />
      <ReturnActions
        organizationId={organizationId}
        orgSlug={props.orgSlug}
        salesReturn={salesReturn}
        canReverse={canReverse}
        exchangeNote={salesReturn.exchangeOrderId === null ? undefined : labels.detail.exchange}
        allowedMethods={allowedMethodsOf(settings)}
        methodLabels={paymentLabelsOf(t).method}
        labels={labels}
        approvalLabels={orderLabelsOf(t).approval}
      />
    </div>
  );
}
