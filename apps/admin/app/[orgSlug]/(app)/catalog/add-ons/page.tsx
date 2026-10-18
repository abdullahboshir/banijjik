import type { ReactElement } from "react";
import { AddOnsPage } from "../../../../../src/catalog/add-ons-page";

export default async function CatalogAddOnsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <AddOnsPage orgSlug={orgSlug} />;
}
