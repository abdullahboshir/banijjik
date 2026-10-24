import type { ReactElement } from "react";
import { ReportDetailPage } from "../../../../../../src/directory/report-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; listingId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, listingId } = await params;
  return <ReportDetailPage orgSlug={orgSlug} listingId={listingId} />;
}
