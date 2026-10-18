import type { ReactElement } from "react";
import { FailedEventsPage } from "../../../src/failed-events/failed-events-page";

export default async function FailedEventsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  return <FailedEventsPage searchParams={await searchParams} />;
}
