import type { ReactElement } from "react";
import { OfferingEditPage } from "../../../../../src/catalog/offering-edit-page";

export default async function OfferingPage({
  params,
}: {
  params: Promise<{ orgSlug: string; offeringId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, offeringId } = await params;
  return <OfferingEditPage orgSlug={orgSlug} offeringId={offeringId} />;
}
