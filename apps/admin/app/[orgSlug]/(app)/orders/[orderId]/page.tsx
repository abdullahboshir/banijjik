import type { ReactElement } from "react";
import { OrderDetailPage } from "../../../../../src/sales/order-detail-page";

export default async function OrderDetailRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; orderId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, orderId } = await params;
  return <OrderDetailPage orgSlug={orgSlug} orderId={orderId} />;
}
