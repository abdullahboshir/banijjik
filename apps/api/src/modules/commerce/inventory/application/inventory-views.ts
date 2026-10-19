import type { Money } from "@banijjik/contracts/catalog";
import type {
  InventoryItemResponse,
  InventoryLevelRow,
  StockMovementResponse,
} from "@banijjik/contracts/inventory";
import { lineValueMinor, microsToMinor } from "../domain/money-math.js";
import type { InventoryItem } from "../domain/inventory-item.entity.js";

/** Movement fields the list and detail views need (no infrastructure import). */
export interface StockMovementViewSource {
  readonly stockMovementId: string;
  readonly inventoryItemId: string;
  readonly locationId: string;
  readonly quantityDelta: number;
  readonly stockState: StockMovementResponse["stockState"];
  readonly reason: StockMovementResponse["reason"];
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reversesStockMovementId?: string | undefined;
  readonly unitCostAmount?: number | undefined;
  readonly unitCostCurrency?: string | undefined;
  readonly occurredAt: Date;
  readonly businessDate: string;
  readonly note?: string | undefined;
}

export function toInventoryItemResponse(item: InventoryItem): InventoryItemResponse {
  return {
    inventoryItemId: item.inventoryItemId,
    name: item.name,
    ...(item.sku === undefined ? {} : { sku: item.sku }),
    baseUnitKey: item.baseUnitKey,
    ...(item.lowStockThreshold === undefined ? {} : { lowStockThreshold: item.lowStockThreshold }),
    status: item.status,
    version: item.version,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toStockMovementResponse(movement: StockMovementViewSource): StockMovementResponse {
  return {
    stockMovementId: movement.stockMovementId,
    inventoryItemId: movement.inventoryItemId,
    locationId: movement.locationId,
    quantityDelta: movement.quantityDelta,
    stockState: movement.stockState,
    reason: movement.reason,
    sourceType: movement.sourceType,
    sourceId: movement.sourceId,
    ...(movement.reversesStockMovementId === undefined
      ? {}
      : { reversesStockMovementId: movement.reversesStockMovementId }),
    ...(movement.unitCostAmount === undefined
      ? {}
      : {
          unitCost: {
            amount: movement.unitCostAmount,
            currency: movement.unitCostCurrency as Money["currency"],
          },
        }),
    occurredAt: movement.occurredAt.toISOString(),
    businessDate: movement.businessDate,
    ...(movement.note === undefined ? {} : { note: movement.note }),
  };
}

export function toInventoryLevelRow(row: Record<string, unknown>): InventoryLevelRow {
  const item = row["item"] as Record<string, unknown>;
  const onHand = row["onHand"] as number;
  const reserved = row["reserved"] as number;
  const available = (row["available"] as number | undefined) ?? onHand - reserved;
  const averageUnitCostMicros = row["averageUnitCostMicros"] as number;
  const currency = row["averageUnitCostCurrency"] as Money["currency"];
  return {
    inventoryItemId: row["inventoryItemId"] as string,
    locationId: row["locationId"] as string,
    itemName: item["name"] as string,
    baseUnitKey: item["baseUnitKey"] as InventoryLevelRow["baseUnitKey"],
    itemStatus: item["status"] as InventoryLevelRow["itemStatus"],
    onHand,
    reserved,
    damaged: row["damaged"] as number,
    available,
    averageUnitCost: {
      amount: microsToMinor(averageUnitCostMicros),
      currency,
    },
    inventoryValue: {
      amount: lineValueMinor(averageUnitCostMicros, onHand),
      currency,
    },
    lowStock: Boolean(row["lowStockActive"]),
  };
}
