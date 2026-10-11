import type { ReactElement } from "react";
import { StaffDetailPage } from "../../../../../../src/staff/staff-detail-page";

export default async function MemberPage({
  params,
}: {
  params: Promise<{ orgSlug: string; memberId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, memberId } = await params;
  return <StaffDetailPage orgSlug={orgSlug} memberId={memberId} />;
}
