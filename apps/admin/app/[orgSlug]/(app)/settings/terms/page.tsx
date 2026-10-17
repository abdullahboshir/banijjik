import type { ReactElement } from "react";
import { TermsPage } from "../../../../../src/terms/terms-page";

export default async function SettingsTermsRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <TermsPage orgSlug={orgSlug} />;
}
