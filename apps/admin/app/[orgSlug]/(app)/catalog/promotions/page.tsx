import type { ReactElement } from "react";
import { PromotionsPage } from "../../../../../src/pricing/promotions-page";

export default async function CatalogPromotionsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <PromotionsPage orgSlug={orgSlug} />;
}
