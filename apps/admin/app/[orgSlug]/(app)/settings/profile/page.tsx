import type { ReactElement } from "react";
import { ProfilePage } from "../../../../../src/profile/profile-page";

export default async function SettingsProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <ProfilePage orgSlug={orgSlug} />;
}
