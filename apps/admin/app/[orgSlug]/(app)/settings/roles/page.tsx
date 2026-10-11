import type { ReactElement } from "react";
import { RolesPage } from "../../../../../src/roles/roles-page";

export default async function SettingsRolesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <RolesPage orgSlug={orgSlug} />;
}
