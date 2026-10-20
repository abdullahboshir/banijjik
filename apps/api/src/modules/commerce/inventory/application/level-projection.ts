import { STOCK_MOVEMENT_REASON, type StockMovementReason } from "@banijjik/contracts/inventory";
import { nextMovingAverage } from "../domain/moving-average.js";
import { minorToMicros } from "../domain/money-math.js";
import type { StockMovementRecord } from "./ports/stock-records.js";

export interface ProjectedLevel {
  readonly onHand: number;
  readonly reserved: number;
  readonly damaged: number;
  readonly averageUnitCostMicros: number;
}

function deltasFor(
  reason: StockMovementReason,
  quantityDelta: number,
): {
  readonly onHandDelta: number;
  readonly damagedDelta: number;
} {
  if (reason === STOCK_MOVEMENT_REASON.DAMAGE_WRITE_OFF) {
    return { onHandDelta: quantityDelta, damagedDelta: -quantityDelta };
  }
  if (reason === STOCK_MOVEMENT_REASON.RETURN_DAMAGED) {
    return { onHandDelta: 0, damagedDelta: quantityDelta };
  }
  return { onHandDelta: quantityDelta, damagedDelta: 0 };
}

function incomingCostMicros(movement: StockMovementRecord): number | undefined {
  if (movement.unitCostMicros !== undefined) return movement.unitCostMicros;
  if (movement.unitCostAmount === undefined) return undefined;
  return minorToMicros(movement.unitCostAmount);
}

/** Replays movements in order to derive level projections (rebuild check). */
export function projectLevelsFromMovements(
  movements: readonly StockMovementRecord[],
): Map<string, ProjectedLevel> {
  const map = new Map<string, ProjectedLevel>();
  for (const movement of movements) {
    const key = `${movement.locationId}:${movement.inventoryItemId}`;
    const existing = map.get(key) ?? {
      onHand: 0,
      reserved: 0,
      damaged: 0,
      averageUnitCostMicros: 0,
    };
    const { onHandDelta, damagedDelta } = deltasFor(movement.reason, movement.quantityDelta);
    const nextOnHand = existing.onHand + onHandDelta;
    const nextDamaged = existing.damaged + damagedDelta;
    let averageUnitCostMicros = existing.averageUnitCostMicros;
    const incomingMicros = incomingCostMicros(movement);
    const updatesAverage =
      incomingMicros !== undefined &&
      onHandDelta > 0 &&
      (movement.reason === STOCK_MOVEMENT_REASON.PURCHASE ||
        movement.reason === STOCK_MOVEMENT_REASON.OPENING ||
        movement.reason === STOCK_MOVEMENT_REASON.TRANSFER_IN ||
        movement.reason === STOCK_MOVEMENT_REASON.RETURN);
    if (updatesAverage && incomingMicros !== undefined) {
      averageUnitCostMicros = nextMovingAverage({
        onHand: existing.onHand,
        averageUnitCostMicros: existing.averageUnitCostMicros,
        incomingQuantity: onHandDelta,
        incomingUnitCostMicros: incomingMicros,
      });
    }
    map.set(key, {
      onHand: nextOnHand,
      reserved: existing.reserved,
      damaged: nextDamaged,
      averageUnitCostMicros,
    });
  }
  return map;
}
