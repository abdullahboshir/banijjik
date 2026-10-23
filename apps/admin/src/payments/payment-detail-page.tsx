import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { PaymentResponse } from "@banijjik/contracts/payment";
import { DetailHeader, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { paymentLabelsOf } from "./payment-labels";
import { PaymentDetailView } from "./payment-detail-view";

export interface PaymentDetailPageProps {
  readonly orgSlug: string;
  readonly paymentId: string;
}

export async function PaymentDetailPage(props: PaymentDetailPageProps): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  const { permissions } = access.config;

  if (!holdsPermission(permissions, PERMISSION_KEY.PAYMENT_PAYMENT_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }

  const { organizationId } = access.organization;
  const [paymentResult, locationsResult] = await Promise.all([
    fetchBusinessResource<PaymentResponse>(`/orgs/${organizationId}/payments/${props.paymentId}`),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
    ),
  ]);

  const payment = paymentResult.data;
  const location = locationsResult?.find((l) => l.locationId === payment.locationId);
  const labels = paymentLabelsOf(t);

  const canRefund =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.PAYMENT_PAYMENT_REFUND);
  const canReverse =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.PAYMENT_PAYMENT_REVERSE);

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={payment.paymentNumber}
        backHref={`/${props.orgSlug}/payments`}
        backLabel={labels.detail.back}
        status={
          <span className="text-body font-semibold text-primary">
            {labels.direction[payment.direction] ?? payment.direction}
          </span>
        }
        facts={
          <span className="text-body text-secondary">
            {payment.businessDate} · {labels.method[payment.method] ?? payment.method}
          </span>
        }
      />

      <PaymentDetailView
        organizationId={organizationId}
        payment={payment}
        locationName={location?.name}
        canRefund={canRefund}
        canReverse={canReverse}
        locale={locale}
        labels={labels}
      />
    </div>
  );
}
