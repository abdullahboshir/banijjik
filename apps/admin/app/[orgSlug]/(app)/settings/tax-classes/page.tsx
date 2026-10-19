import type { ReactElement } from "react";
import { TaxClassesPage } from "../../../../../src/pricing/tax-classes-page";

export default async function SettingsTaxClassesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <TaxClassesPage orgSlug={orgSlug} />;
}
