import { defineEnum } from "../define-enum.js";
import type { Money } from "../catalog/catalog-contracts.js";
import type { UnitKey } from "../catalog/unit-registry.js";

export const INVENTORY_ITEM_STATUS = defineEnum(["ACTIVE", "ARCHIVED"]);
export type InventoryItemStatus =
  (typeof INVENTORY_ITEM_STATUS)[keyof typeof INVENTORY_ITEM_STATUS];

export const STOCK_MOVEMENT_REASON = defineEnum([
  "OPENING",
  "PURCHASE",
  "ADJUSTMENT",
  "DAMAGE_WRITE_OFF",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "SALE",
  "RETURN",
  "RETURN_DAMAGED",
  "RETURN_REVERSAL",
]);
export type StockMovementReason =
  (typeof STOCK_MOVEMENT_REASON)[keyof typeof STOCK_MOVEMENT_REASON];

export const STOCK_STATE = defineEnum(["SELLABLE", "DAMAGED"]);
export type StockState = (typeof STOCK_STATE)[keyof typeof STOCK_STATE];

/** Idempotency key for reservations and ledger side effects from other modules (card 3.5). */
export const STOCK_SOURCE_TYPE = defineEnum([
  "TEST",
  "ORDER",
  "STOCK_RECEIPT",
  "STOCK_OPENING",
  "STOCK_ADJUSTMENT",
  "STOCK_TRANSFER",
  "SALES_RETURN",
]);
export type StockSourceType = (typeof STOCK_SOURCE_TYPE)[keyof typeof STOCK_SOURCE_TYPE];

export const STOCK_ADJUSTMENT_REASON = defineEnum(["ADJUSTMENT", "DAMAGE_WRITE_OFF"]);
export type StockAdjustmentReason =
  (typeof STOCK_ADJUSTMENT_REASON)[keyof typeof STOCK_ADJUSTMENT_REASON];

export const STOCK_RECEIPT_PAID_VIA = defineEnum(["CASH", "BKASH", "NAGAD", "BANK", "ON_CREDIT"]);
export type StockReceiptPaidVia =
  (typeof STOCK_RECEIPT_PAID_VIA)[keyof typeof STOCK_RECEIPT_PAID_VIA];

export const INVENTORY_ALLOW_NEGATIVE_STOCK_SETTING_KEY = "inventory.allowNegativeStock";
export const INVENTORY_LOW_STOCK_DEFAULT_SETTING_KEY = "inventory.lowStockDefault";
export const INVENTORY_ADJUSTMENT_APPROVAL_ABOVE_SETTING_KEY = "inventory.adjustment.approvalAbove";

export interface InventoryItemResponse {
  readonly inventoryItemId: string;
  readonly name: string;
  readonly sku?: string;
  readonly baseUnitKey: UnitKey;
  readonly lowStockThreshold?: number;
  readonly status: InventoryItemStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InventoryItemListItem {
  readonly inventoryItemId: string;
  readonly name: string;
  readonly sku?: string;
  readonly baseUnitKey: UnitKey;
  readonly status: InventoryItemStatus;
}

export interface StockMovementResponse {
  readonly stockMovementId: string;
  readonly inventoryItemId: string;
  readonly locationId: string;
  readonly quantityDelta: number;
  readonly stockState: StockState;
  readonly reason: StockMovementReason;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reversesStockMovementId?: string;
  readonly unitCost?: Money;
  readonly occurredAt: string;
  readonly businessDate: string;
  readonly note?: string;
  readonly paidVia?: StockReceiptPaidVia;
}

export interface InventoryLevelRow {
  readonly inventoryItemId: string;
  readonly locationId: string;
  readonly itemName: string;
  readonly baseUnitKey: UnitKey;
  readonly itemStatus: InventoryItemStatus;
  readonly onHand: number;
  readonly reserved: number;
  readonly damaged: number;
  readonly available: number;
  /** Display average in minor units per base unit (half-up from micros). */
  readonly averageUnitCost: Money;
  /** onHand × average in micros, rounded half up once to minor units (ADR-125). */
  readonly inventoryValue: Money;
  readonly lowStock: boolean;
}

export interface VariantAvailability {
  readonly variantId: string;
  readonly availableQuantity: number;
}

export interface OfferingAvailabilityResponse {
  readonly offeringId: string;
  readonly locationId: string;
  readonly variants: readonly VariantAvailability[];
}

export interface StockLedgerLine {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
}

export type StockReturnDisposition = "RETURN" | "RETURN_DAMAGED";

export interface InventoryStockChangedPayload {
  readonly inventoryItemId: string;
  readonly locationId: string;
  readonly onHand: number;
  readonly available: number;
}

export interface InventoryStockLowPayload {
  readonly inventoryItemId: string;
  readonly locationId: string;
  readonly available: number;
}

export interface InventoryTransferCompletedPayload {
  readonly transferNumber: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
}

export interface InventoryStockSourceRecordedPayload {
  readonly sourceType: string;
  readonly sourceId: string;
}
