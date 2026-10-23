import { PERMISSION_KEY, type CurrencyCode, type SettingsResponse } from "@banijjik/contracts";
import type { BookingResponse } from "@banijjik/contracts/booking";
import {
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_METHODS_SETTING_KEY,
  type PaymentMethod,
} from "@banijjik/contracts/payment";
import type { Locale, Translator } from "@banijjik/i18n";
import { currencySymbolOf, DetailHeader, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { loadCurrency } from "../catalog/catalog-lookups";
import { fetchBusinessResource, fetchBusinessResourceIfAllowed } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { paymentLabelsOf } from "../payments/payment-labels";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { formatLocalTimeRange } from "./booking-local-time";
import { bookingStatusLabelOf } from "./booking-labels";
import { BookingDetailActions } from "./booking-detail-actions";
import { BookingDetailHistory } from "./booking-detail-history";
import { BookingDetailPaymentSection } from "./booking-detail-payment-section";

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

interface BookingDetailLayoutProps {
  readonly orgSlug: string;
  readonly organizationId: string;
  readonly booking: BookingResponse;
  readonly currency: CurrencyCode;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly permissions: { canUpdate: boolean; canCancel: boolean; canReceive: boolean };
  readonly locale: Locale;
  readonly timeZone: string;
  readonly t: Translator["t"];
}

function BookingDetailHeaderSection(props: {
  readonly orgSlug: string;
  readonly booking: BookingResponse;
  readonly locale: Locale;
  readonly timeZone: string;
  readonly t: Translator["t"];
}): ReactElement {
  const { orgSlug, booking, locale, timeZone, t } = props;
  return (
    <DetailHeader
      title={booking.bookingNumber ?? t("bookings.unnumbered")}
      backHref={`/${orgSlug}/bookings`}
      backLabel={t("bookings.detail.back")}
      status={
        <span className="text-body text-primary">{bookingStatusLabelOf(booking.status, t)}</span>
      }
      facts={
        <span className="text-body text-primary">
          {formatLocalTimeRange({
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            locale,
            timeZone,
          })}
        </span>
      }
    />
  );
}

function BookingDetailLayout(props: BookingDetailLayoutProps): ReactElement {
  const {
    orgSlug,
    organizationId,
    booking,
    currency,
    allowedMethods,
    permissions,
    locale,
    timeZone,
    t,
  } = props;
  const paymentLabels = paymentLabelsOf(t);

  return (
    <div className="flex flex-col gap-6">
      <BookingDetailHeaderSection
        orgSlug={orgSlug}
        booking={booking}
        locale={locale}
        timeZone={timeZone}
        t={t}
      />
      <BookingDetailActions
        organizationId={organizationId}
        booking={booking}
        permissions={{ canUpdate: permissions.canUpdate, canCancel: permissions.canCancel }}
        labels={{
          confirm: t("bookings.action.confirm"),
          checkIn: t("bookings.action.checkIn"),
          complete: t("bookings.action.complete"),
          noShow: t("bookings.action.noShow"),
          cancel: t("bookings.action.cancel"),
          cancelReason: t("bookings.cancel.reason"),
        }}
      />
      <BookingDetailPaymentSection
        organizationId={organizationId}
        booking={booking}
        currency={currency}
        currencySymbol={currencySymbolOf(currency)}
        allowedMethods={allowedMethods}
        canReceive={permissions.canReceive}
        locale={locale}
        labels={{
          paymentStatus: t("bookings.detail.paymentStatus"),
          receivePayment: t("bookings.detail.receivePayment"),
          totalPrice: t("bookings.detail.totalPrice"),
          depositRequired: t("bookings.detail.depositRequired"),
          statusLabels: paymentLabels.status,
          sheetLabels: { ...paymentLabels.receiveSheet, methodLabels: paymentLabels.method },
        }}
      />
      <BookingDetailHistory history={booking.history} title={t("bookings.detail.history")} />
    </div>
  );
}

export async function BookingDetailPage(props: {
  readonly orgSlug: string;
  readonly bookingId: string;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKING_BOOKING_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const organizationId = access.organization.organizationId;
  const [{ data: booking }, currency, settingsResult] = await Promise.all([
    fetchBusinessResource<BookingResponse>(`/orgs/${organizationId}/bookings/${props.bookingId}`),
    loadCurrency(access),
    fetchBusinessResourceIfAllowed<SettingsResponse>(
      `/orgs/${organizationId}/settings?keys=${PAYMENT_METHODS_SETTING_KEY}`,
    ),
  ]);

  const allowedMethods = resolveAllowedMethods(settingsResult);
  const permissions = access.config.permissions;
  const canUpdate =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.BOOKING_BOOKING_UPDATE);
  const canCancel =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.BOOKING_BOOKING_CANCEL);
  const canReceive =
    access.canWrite && holdsPermission(permissions, PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE);

  return (
    <BookingDetailLayout
      orgSlug={props.orgSlug}
      organizationId={organizationId}
      booking={booking}
      currency={currency}
      allowedMethods={allowedMethods}
      permissions={{ canUpdate, canCancel, canReceive }}
      locale={locale}
      timeZone={access.timeZone}
      t={t}
    />
  );
}
