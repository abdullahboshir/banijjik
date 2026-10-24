import type { ReactElement } from "react";
import { EventSessionsPage } from "../../../../../src/bookings/event-sessions-page";
export default async function EventSessionsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  return <EventSessionsPage orgSlug={(await params).orgSlug} />;
}
