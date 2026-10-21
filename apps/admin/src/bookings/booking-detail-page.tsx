import { PERMISSION_KEY } from "@banijjik/contracts";
import type { BookingResponse } from "@banijjik/contracts/booking";
import { DetailHeader, EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { fetchBusinessResource } from "../lib/api/server-resource";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { formatLocalTimeRange } from "./booking-local-time";
import { bookingStatusLabelOf } from "./booking-labels";
import { BookingDetailActions } from "./booking-detail-actions";
import { BookingDetailHistory } from "./booking-detail-history";

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
  const canUpdate =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKING_BOOKING_UPDATE);
  const canCancel =
    access.canWrite &&
    holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKING_BOOKING_CANCEL);
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        title={booking.bookingNumber ?? t("bookings.unnumbered")}
        backHref={`/${props.orgSlug}/bookings`}
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
              timeZone: access.timeZone,
            })}
          </span>
        }
      />
      <BookingDetailActions
        organizationId={organizationId}
        booking={booking}
        permissions={{ canUpdate, canCancel }}
        labels={{
          confirm: t("bookings.action.confirm"),
          checkIn: t("bookings.action.checkIn"),
          complete: t("bookings.action.complete"),
          noShow: t("bookings.action.noShow"),
          cancel: t("bookings.action.cancel"),
          cancelReason: t("bookings.cancel.reason"),
        }}
      />
      <BookingDetailHistory history={booking.history} title={t("bookings.detail.history")} />
    </div>
  );
}
