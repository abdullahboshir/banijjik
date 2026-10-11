import type { ReactElement } from "react";
import { LocationsPage } from "../../../../../src/locations/locations-page";

export default async function SettingsLocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <LocationsPage orgSlug={orgSlug} searchParams={query} />;
}
