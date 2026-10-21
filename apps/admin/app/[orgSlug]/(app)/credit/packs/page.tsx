import type { ReactElement } from "react";
import { CreditPacksPage } from "../../../../../src/credit/credit-packs-page";

export default async function CreditPacksRoute({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<ReactElement> {
  const { orgSlug } = await params;
  return <CreditPacksPage orgSlug={orgSlug} />;
}
