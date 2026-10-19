import { INVENTORY_EVENT_TYPE } from "@banijjik/contracts/inventory";
import type { InventoryItemId } from "@banijjik/ids";
import type { InventoryEventPublisher } from "./ports/inventory-context-ports.js";

export async function publishStockChangeEvents(input: {
  readonly events: InventoryEventPublisher;
  readonly orderingKey: string;
  readonly inventoryItemId: InventoryItemId;
  readonly locationId: string;
  readonly nextOnHand: number;
  readonly nextAvailable: number;
  readonly crossedLowStock: boolean;
}): Promise<void> {
  await input.events.publish(
    INVENTORY_EVENT_TYPE.STOCK_CHANGED,
    {
      inventoryItemId: input.inventoryItemId,
      locationId: input.locationId,
      onHand: input.nextOnHand,
      available: input.nextAvailable,
    },
    { orderingKey: input.orderingKey },
  );
  if (!input.crossedLowStock) return;
  await input.events.publish(
    INVENTORY_EVENT_TYPE.STOCK_LOW,
    {
      inventoryItemId: input.inventoryItemId,
      locationId: input.locationId,
      available: input.nextAvailable,
    },
    { orderingKey: input.orderingKey },
  );
}
