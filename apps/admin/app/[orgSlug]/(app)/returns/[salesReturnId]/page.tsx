import type { ReactElement } from "react";
import { ReturnDetailPage } from "../../../../../src/sales/return-detail-page";

export default async function ReturnDetailRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; salesReturnId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, salesReturnId } = await params;
  return <ReturnDetailPage orgSlug={orgSlug} salesReturnId={salesReturnId} />;
}
