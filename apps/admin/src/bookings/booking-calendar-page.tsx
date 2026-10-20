import { PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";

/** Day calendar of bookings. Wired to the booking API as card 3.6 finishes. */
export async function BookingCalendarPage(props: {
  readonly orgSlug: string;
  readonly searchParams: Record<string, string | string[] | undefined>;
}): Promise<ReactElement> {
  void props.searchParams;
  await requireOrgAccess(props.orgSlug);
  const { t } = await getTranslator();
  return (
    <PageLayout title={t("menu.booking.calendar")} subtitle={t("bookings.calendar.subtitle")}>
      <p>{t("bookings.calendar.placeholder")}</p>
    </PageLayout>
  );
}
