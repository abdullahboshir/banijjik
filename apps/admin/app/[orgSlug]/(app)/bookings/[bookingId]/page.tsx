import type { ReactElement } from "react";
import { BookingDetailPage } from "../../../../../src/bookings/booking-detail-page";

export default async function BookingDetailRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; bookingId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, bookingId } = await params;
  return <BookingDetailPage orgSlug={orgSlug} bookingId={bookingId} />;
}
