export {
  inventoryItemCreateRequestSchema,
  inventoryItemIdParamsSchema,
  inventoryItemListQuerySchema,
  inventoryItemUpdateRequestSchema,
} from "./item-schemas.js";
export type { InventoryItemCreateBody, InventoryItemUpdateBody } from "./item-schemas.js";
export {
  inventoryLevelsRebuildRequestSchema,
  offeringAvailabilityQuerySchema,
  stockAdjustmentRequestSchema,
  stockLevelsQuerySchema,
  stockMovementsQuerySchema,
  stockReceiptRequestSchema,
  stockTransferRequestSchema,
} from "./stock-schemas.js";
export type {
  InventoryLevelsRebuildBody,
  OfferingAvailabilityQuery,
  StockAdjustmentBody,
  StockLevelsQuery,
  StockMovementsQuery,
  StockReceiptBody,
  StockTransferBody,
} from "./stock-schemas.js";
