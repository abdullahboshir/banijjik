import { PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess } from "../shell/org-access";

export async function BookingDetailPage(props: {
  readonly orgSlug: string;
  readonly bookingId: string;
}): Promise<ReactElement> {
  void props.bookingId;
  await requireOrgAccess(props.orgSlug);
  const { t } = await getTranslator();
  return (
    <PageLayout title={t("menu.booking.bookings")} subtitle={t("bookings.detail.subtitle")}>
      <p>{t("bookings.detail.placeholder")}</p>
    </PageLayout>
  );
}
