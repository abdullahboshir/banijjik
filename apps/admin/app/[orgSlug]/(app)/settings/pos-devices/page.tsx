import type { ReactElement } from "react";
import { PosDevicesPage } from "../../../../../src/pos-devices/pos-devices-page";

export default async function SettingsPosDevicesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <PosDevicesPage orgSlug={orgSlug} searchParams={query} />;
}
