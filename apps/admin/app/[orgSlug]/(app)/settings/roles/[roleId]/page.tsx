import type { ReactElement } from "react";
import { RoleDetailPage } from "../../../../../../src/roles/role-detail-page";

export default async function SettingsRoleDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; roleId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, roleId } = await params;
  return <RoleDetailPage orgSlug={orgSlug} roleId={roleId} />;
}
