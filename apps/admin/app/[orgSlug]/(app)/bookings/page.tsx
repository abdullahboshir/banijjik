import type { ReactElement } from "react";
import { BookingCalendarPage } from "../../../../src/bookings/booking-calendar-page";

export default async function BookingsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <BookingCalendarPage orgSlug={orgSlug} searchParams={query} />;
}
