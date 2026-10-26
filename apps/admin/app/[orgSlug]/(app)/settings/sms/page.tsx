import type { ReactElement } from "react";
import { SmsSettingsPage } from "../../../../../src/sms/sms-settings-page";

export default async function SettingsSmsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <SmsSettingsPage orgSlug={orgSlug} />;
}
