import type { ReactElement } from "react";
import { ListingReviewPage } from "../../../../../../src/directory/listing-review-page";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; listingId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, listingId } = await params;
  return <ListingReviewPage orgSlug={orgSlug} listingId={listingId} />;
}
