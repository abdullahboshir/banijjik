import type { ReactElement } from "react";
import { SettingsGeneralPage } from "../../../../../src/settings-general/settings-general-page";

export default async function SettingsGeneralRoute({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactElement> {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  return <SettingsGeneralPage orgSlug={orgSlug} searchParams={query} />;
}
