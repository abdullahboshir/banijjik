import { PERMISSION_KEY } from "@banijjik/contracts";
import { EmptyState, PageLayout } from "@banijjik/ui";
import { termLabel } from "@banijjik/web-client";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { BookingLocationDateFilter } from "./booking-location-date-filter";
import { loadBookingCalendarData } from "./booking-calendar-load";
import { LazyBookingCalendar } from "./lazy-booking-calendar";
import type { NewBookingSheetLabels } from "./new-booking-sheet";

function sheetLabelsOf(t: (key: string) => string): NewBookingSheetLabels {
  return {
    title: t("bookings.sheet.title"),
    close: t("bookings.form.close"),
    back: t("bookings.form.back"),
    next: t("bookings.form.next"),
    confirm: t("bookings.sheet.confirm"),
    service: t("bookings.sheet.service"),
    variant: t("bookings.sheet.variant"),
    slot: t("bookings.sheet.slot"),
    contact: t("bookings.sheet.contact"),
    note: t("bookings.sheet.note"),
    chooseService: t("bookings.sheet.chooseService"),
    chooseVariant: t("bookings.sheet.chooseVariant"),
    loadingSlots: t("bookings.sheet.loadingSlots"),
    noSlots: t("bookings.sheet.noSlots"),
    notSet: t("profile.notSet"),
    conflict: t("bookings.form.conflict"),
    reload: t("bookings.form.reload"),
  };
}

export async function BookingCalendarPage(props: {
  readonly orgSlug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.BOOKING_BOOKING_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const loaded = await loadBookingCalendarData({ searchParams: props.searchParams, access });
  if (loaded.noLocation) {
    return (
      <PageLayout title={t("menu.booking.calendar")} subtitle={t("bookings.calendar.subtitle")}>
        <EmptyState kind="none" message={t("bookings.calendar.noLocation")} />
      </PageLayout>
    );
  }
  const bookingTerm = termLabel(access.config.terms, "booking", {
    locale,
    fallback: t("term.booking.singular"),
  });
  const basePath = `/${props.orgSlug}/bookings`;
  const labels = {
    loading: t("bookings.calendar.loading"),
    addBooking: t("bookings.calendar.add", { term: bookingTerm }),
    addSlot: t("bookings.calendar.addSlot"),
    unnumbered: t("bookings.unnumbered"),
    minutesSuffix: t("bookings.calendar.minutesUnit"),
    sheet: sheetLabelsOf(t),
  };
  return (
    <PageLayout title={t("menu.booking.calendar")} subtitle={t("bookings.calendar.subtitle")}>
      <BookingLocationDateFilter
        basePath={basePath}
        query={loaded.query}
        locations={loaded.locations}
        locationLabel={t("bookings.form.location")}
        dateLabel={t("bookings.form.date")}
      />
      <LazyBookingCalendar
        orgSlug={props.orgSlug}
        organizationId={loaded.organizationId}
        query={loaded.query}
        locationId={loaded.query.locationId}
        timeZone={access.timeZone}
        locale={locale}
        slotStepMinutes={loaded.slotStepMinutes}
        resources={loaded.resources}
        bookings={loaded.bookings}
        offerings={loaded.offerings}
        canCreate={loaded.canCreate}
        labels={labels}
      />
    </PageLayout>
  );
}
