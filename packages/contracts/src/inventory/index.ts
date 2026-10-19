/**
 * Inventory contracts (card 3.3), public entry `@banijjik/contracts/inventory`.
 */
export {
  INVENTORY_ADJUSTMENT_APPROVAL_ABOVE_SETTING_KEY,
  INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY,
  INVENTORY_ITEM_STATUS,
  INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY,
  STOCK_ADJUSTMENT_REASON,
  STOCK_MOVEMENT_REASON,
  STOCK_SOURCE_TYPE,
  STOCK_STATE,
  type InventoryItemListItem,
  type InventoryItemResponse,
  type InventoryItemStatus,
  type InventoryLevelRow,
  type OfferingAvailabilityResponse,
  type StockAdjustmentReason,
  type StockLedgerLine,
  type StockMovementReason,
  type StockMovementResponse,
  type StockReturnDisposition,
  type StockSourceType,
  type StockState,
  type VariantAvailability,
  type InventoryStockChangedPayload,
  type InventoryStockLowPayload,
  type InventoryTransferCompletedPayload,
} from "./inventory-contracts.js";
export { INVENTORY_EVENT_TYPE, type InventoryEventType } from "./inventory-event-type.js";
export { INVENTORY_RULE_KEY, type InventoryRuleKey } from "./inventory-rule-key.js";
