import type { ReactElement } from "react";
import { SettingsHomePage } from "../../../../src/settings-home/settings-home-page";

export default async function SettingsHomeRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <SettingsHomePage orgSlug={orgSlug} />;
}
