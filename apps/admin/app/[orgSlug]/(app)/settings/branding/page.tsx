import type { ReactElement } from "react";
import { BrandingPage } from "../../../../../src/branding/branding-page";

export default async function SettingsBrandingPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <BrandingPage orgSlug={orgSlug} />;
}
