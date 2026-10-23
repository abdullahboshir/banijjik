import {
  PERMISSION_KEY,
  type CallerPermissionsResponse,
  type CurrencyCode,
  type LocationResponse,
  type SettingsResponse,
} from "@banijjik/contracts";
import type { BookingResponse } from "@banijjik/contracts/booking";
import {
  PAYMENT_METHODS_DEFAULT,
  PAYMENT_METHODS_SETTING_KEY,
  type DueItemResponse,
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
  readonly locationName: string;
  readonly remainingDueMinor: number;
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

function BookingActionsSection(props: {
  readonly organizationId: string;
  readonly booking: BookingResponse;
  readonly permissions: { canUpdate: boolean; canCancel: boolean };
  readonly t: Translator["t"];
}): ReactElement {
  return (
    <BookingDetailActions
      organizationId={props.organizationId}
      booking={props.booking}
      permissions={props.permissions}
      labels={{
        confirm: props.t("bookings.action.confirm"),
        checkIn: props.t("bookings.action.checkIn"),
        complete: props.t("bookings.action.complete"),
        noShow: props.t("bookings.action.noShow"),
        cancel: props.t("bookings.action.cancel"),
        cancelReason: props.t("bookings.cancel.reason"),
      }}
    />
  );
}

function resolveRemainingDue(
  booking: BookingResponse,
  dueItem: DueItemResponse | undefined,
): number {
  if (dueItem) return dueItem.due.amount;
  if (booking.paymentStatus === "PAID") return 0;
  return booking.price.total.amount;
}

function resolveBookingPermissions(permissions: CallerPermissionsResponse, canWrite: boolean) {
  return {
    canUpdate: canWrite && holdsPermission(permissions, PERMISSION_KEY.BOOKING_BOOKING_UPDATE),
    canCancel: canWrite && holdsPermission(permissions, PERMISSION_KEY.BOOKING_BOOKING_CANCEL),
    canReceive: canWrite && holdsPermission(permissions, PERMISSION_KEY.PAYMENT_PAYMENT_RECEIVE),
  };
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
      <BookingActionsSection
        organizationId={organizationId}
        booking={booking}
        permissions={{ canUpdate: permissions.canUpdate, canCancel: permissions.canCancel }}
        t={t}
      />
      <BookingDetailPaymentSection
        organizationId={organizationId}
        booking={booking}
        locationName={props.locationName}
        remainingDueMinor={props.remainingDueMinor}
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
          sheetLabels: {
            ...paymentLabels.receiveSheet,
            methodLabels: paymentLabels.method,
            requestTypeLabels: paymentLabels.requestType,
          },
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
  const { data: booking } = await fetchBusinessResource<BookingResponse>(
    `/orgs/${organizationId}/bookings/${props.bookingId}`,
  );
  const [currency, settingsResult, duesResult, locationsResult] = await Promise.all([
    loadCurrency(access),
    fetchBusinessResourceIfAllowed<SettingsResponse>(
      `/orgs/${organizationId}/settings?keys=${PAYMENT_METHODS_SETTING_KEY}`,
    ),
    fetchBusinessResourceIfAllowed<DueItemResponse[]>(
      `/orgs/${organizationId}/dues?contactId=${booking.contactId}&requestType=BOOKING`,
    ),
    fetchBusinessResourceIfAllowed<LocationResponse[]>(
      `/orgs/${organizationId}/locations?status=ACTIVE&limit=100`,
    ),
  ]);

  const dueItem = duesResult?.find((d) => d.requestId === booking.bookingId);
  const remainingDueMinor = resolveRemainingDue(booking, dueItem);
  const locationName =
    locationsResult?.find((l) => l.locationId === booking.locationId)?.name ?? booking.locationId;
  const allowedMethods = resolveAllowedMethods(settingsResult);
  const permissions = resolveBookingPermissions(access.config.permissions, access.canWrite);

  return (
    <BookingDetailLayout
      orgSlug={props.orgSlug}
      organizationId={organizationId}
      booking={booking}
      locationName={locationName}
      remainingDueMinor={remainingDueMinor}
      currency={currency}
      allowedMethods={allowedMethods}
      permissions={permissions}
      locale={locale}
      timeZone={access.timeZone}
      t={t}
    />
  );
}
