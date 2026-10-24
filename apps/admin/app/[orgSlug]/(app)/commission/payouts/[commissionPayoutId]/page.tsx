import type { ReactElement } from "react";
import { CommissionPayoutDetailPage } from "../../../../../../src/commission/commission-payout-detail-page";

export default async function CommissionPayoutDetailRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; commissionPayoutId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, commissionPayoutId } = await params;
  return <CommissionPayoutDetailPage orgSlug={orgSlug} commissionPayoutId={commissionPayoutId} />;
}
