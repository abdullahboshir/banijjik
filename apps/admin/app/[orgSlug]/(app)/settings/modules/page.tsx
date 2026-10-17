import type { ReactElement } from "react";
import { ModulesPage } from "../../../../../src/modules/modules-page";

export default async function SettingsModulesRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <ModulesPage orgSlug={orgSlug} />;
}
