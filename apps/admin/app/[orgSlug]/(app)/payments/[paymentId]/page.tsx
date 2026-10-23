import type { ReactElement } from "react";
import { PaymentDetailPage } from "../../../../../src/payments/payment-detail-page";

export default async function Page({
  params,
}: {
  params: Promise<{ orgSlug: string; paymentId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, paymentId } = await params;
  return <PaymentDetailPage orgSlug={orgSlug} paymentId={paymentId} />;
}
