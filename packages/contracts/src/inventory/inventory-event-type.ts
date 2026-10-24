/** Inventory domain events (`<module>.<entity>.<pastTenseVerb>`). Payloads carry ids and quantities only. */
export const INVENTORY_EVENT_TYPE = Object.freeze({
  STOCK_CHANGED: "inventory.stock.changed",
  STOCK_LOW: "inventory.stock.lowCrossed",
  TRANSFER_COMPLETED: "inventory.transfer.completed",
  STOCK_SOURCE_RECORDED: "inventory.stockSource.recorded",
} as const);

export type InventoryEventType = (typeof INVENTORY_EVENT_TYPE)[keyof typeof INVENTORY_EVENT_TYPE];
