import type { ReactElement } from "react";
import { InventoryItemDetailPage } from "../../../../../../src/stock/inventory-item-detail-page";

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ orgSlug: string; inventoryItemId: string }>;
}): Promise<ReactElement> {
  const { orgSlug, inventoryItemId } = await params;
  return <InventoryItemDetailPage orgSlug={orgSlug} inventoryItemId={inventoryItemId} />;
}
