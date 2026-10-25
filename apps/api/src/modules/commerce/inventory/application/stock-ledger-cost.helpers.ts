import type { CurrencyCode } from "@banijjik/contracts";
import { type Money } from "@banijjik/contracts/catalog";
import { STOCK_MOVEMENT_REASON, type StockMovementReason } from "@banijjik/contracts/inventory";
import { nextMovingAverage } from "../domain/moving-average.js";
import { microsToMinor, minorToMicros } from "../domain/money-math.js";
import type { InventoryLevelRecord } from "./ports/stock-records.js";

export function nextAverageUnitCostMicros(input: {
  readonly existing: InventoryLevelRecord;
  readonly reason: StockMovementReason;
  readonly onHandDelta: number;
  readonly unitCost: Money | undefined;
  readonly unitCostMicros?: number;
}): number {
  const incomingMicros =
    input.unitCostMicros ??
    (input.unitCost === undefined ? undefined : minorToMicros(input.unitCost.amount));
  const updatesAverage =
    incomingMicros !== undefined &&
    input.onHandDelta > 0 &&
    (input.reason === STOCK_MOVEMENT_REASON.PURCHASE ||
      input.reason === STOCK_MOVEMENT_REASON.OPENING ||
      input.reason === STOCK_MOVEMENT_REASON.TRANSFER_IN ||
      input.reason === STOCK_MOVEMENT_REASON.RETURN);
  if (!updatesAverage || incomingMicros === undefined) {
    return input.existing.averageUnitCostMicros;
  }
  return nextMovingAverage({
    onHand: input.existing.onHand,
    averageUnitCostMicros: input.existing.averageUnitCostMicros,
    incomingQuantity: input.onHandDelta,
    incomingUnitCostMicros: incomingMicros,
  });
}

export function outgoingUnitCostForMovement(input: {
  readonly reason: StockMovementReason;
  readonly onHandDelta: number;
  readonly existing: InventoryLevelRecord;
  readonly unitCost: Money | undefined;
}): Money | undefined {
  // A reversed return leaves at the cost it came in at, so the books mirror it exactly.
  const keepsStoredCost =
    input.reason === STOCK_MOVEMENT_REASON.RETURN_REVERSAL && input.unitCost !== undefined;
  if (input.onHandDelta < 0 && !keepsStoredCost) {
    return {
      amount: microsToMinor(input.existing.averageUnitCostMicros),
      currency: input.existing.averageUnitCostCurrency as CurrencyCode,
    };
  }
  return input.unitCost;
}

export function costMicrosOnMovement(input: {
  readonly onHandDelta: number;
  readonly existing: InventoryLevelRecord;
  readonly unitCost: Money | undefined;
  readonly unitCostMicros?: number;
}): number | undefined {
  if (input.unitCostMicros !== undefined) return input.unitCostMicros;
  if (input.onHandDelta < 0) return input.existing.averageUnitCostMicros;
  if (input.unitCost === undefined) return undefined;
  return minorToMicros(input.unitCost.amount);
}
