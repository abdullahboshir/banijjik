import { type Money } from "@banijjik/contracts/catalog";
import {
  STOCK_MOVEMENT_REASON,
  STOCK_STATE,
  type StockMovementReason,
  type StockReceiptPaidVia,
} from "@banijjik/contracts/inventory";
import {
  newId,
  type InventoryItemId,
  type OrganizationId,
  type StockMovementId,
  type UserId,
} from "@banijjik/ids";
import { insufficientStock } from "../domain/errors.js";
import type { InventoryLevelRecord, StockMovementRecord } from "./ports/stock-records.js";
import {
  costMicrosOnMovement,
  nextAverageUnitCostMicros,
  outgoingUnitCostForMovement,
} from "./stock-ledger-cost.helpers.js";

export function movementDeltas(
  reason: StockMovementReason,
  quantityDelta: number,
): { readonly onHandDelta: number; readonly damagedDelta: number } {
  if (reason === STOCK_MOVEMENT_REASON.DAMAGE_WRITE_OFF) {
    // Write-off: quantityDelta is negative on sellable; damaged rises by the absolute amount.
    return { onHandDelta: quantityDelta, damagedDelta: -quantityDelta };
  }
  if (reason === STOCK_MOVEMENT_REASON.RETURN_DAMAGED) {
    // Damaged returns restock damaged only (docs/11 §4.5); quantityDelta is positive.
    return { onHandDelta: 0, damagedDelta: quantityDelta };
  }
  return { onHandDelta: quantityDelta, damagedDelta: 0 };
}

export function stockStateForReason(
  reason: StockMovementReason,
): (typeof STOCK_STATE)[keyof typeof STOCK_STATE] {
  if (
    reason === STOCK_MOVEMENT_REASON.RETURN_DAMAGED ||
    reason === STOCK_MOVEMENT_REASON.DAMAGE_WRITE_OFF
  ) {
    return STOCK_STATE.DAMAGED;
  }
  return STOCK_STATE.SELLABLE;
}

export function assertStockAvailable(input: {
  readonly allowNegativeStock: boolean;
  readonly inventoryItemId: InventoryItemId;
  readonly previousAvailable: number;
  readonly nextOnHand: number;
  readonly nextAvailable: number;
}): void {
  if (!input.allowNegativeStock && (input.nextOnHand < 0 || input.nextAvailable < 0)) {
    throw insufficientStock(input.inventoryItemId, input.previousAvailable);
  }
}

function businessDateOf(date: Date, timeZone = "Asia/Dhaka"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const val = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${val("year")}-${val("month")}-${val("day")}`;
}

export function buildStockMovementDocument(input: {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly locationId: string;
  readonly inventoryItemId: InventoryItemId;
  readonly quantityDelta: number;
  readonly reason: StockMovementReason;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reversesStockMovementId?: string;
  readonly offeringId?: string;
  readonly variantId?: string;
  readonly note?: string;
  readonly now: Date;
  readonly outgoingUnitCost: Money | undefined;
  readonly unitCostMicros?: number;
  readonly paidVia?: StockReceiptPaidVia;
}): StockMovementRecord {
  const outgoingUnitCost = input.outgoingUnitCost;
  return {
    stockMovementId: newId<StockMovementId>(),
    organizationId: input.organizationId,
    locationId: input.locationId,
    inventoryItemId: input.inventoryItemId,
    quantityDelta: input.quantityDelta,
    stockState: stockStateForReason(input.reason),
    reason: input.reason,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    ...(input.reversesStockMovementId === undefined
      ? {}
      : { reversesStockMovementId: input.reversesStockMovementId }),
    ...(outgoingUnitCost === undefined
      ? {}
      : { unitCostAmount: outgoingUnitCost.amount, unitCostCurrency: outgoingUnitCost.currency }),
    ...(input.unitCostMicros === undefined ? {} : { unitCostMicros: input.unitCostMicros }),
    ...(input.offeringId === undefined ? {} : { offeringId: input.offeringId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
    ...(input.note === undefined ? {} : { note: input.note }),
    ...(input.paidVia === undefined ? {} : { paidVia: input.paidVia }),
    occurredAt: input.now,
    businessDate: businessDateOf(input.now),
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  };
}

export function buildNextInventoryLevel(input: {
  readonly existing: InventoryLevelRecord;
  readonly nextOnHand: number;
  readonly nextDamaged: number;
  readonly averageUnitCostMicros: number;
  readonly nextAvailable: number;
  readonly threshold: number;
  readonly now: Date;
}): InventoryLevelRecord {
  const isLow = input.nextAvailable <= input.threshold;
  return {
    ...input.existing,
    onHand: input.nextOnHand,
    damaged: input.nextDamaged,
    averageUnitCostMicros: input.averageUnitCostMicros,
    lowStockActive: isLow,
    updatedAt: input.now,
    version: input.existing.version + 1,
  };
}

export function didCrossLowStock(input: {
  readonly previousAvailable: number;
  readonly nextAvailable: number;
  readonly threshold: number;
}): boolean {
  const wasLow = input.previousAvailable <= input.threshold;
  const isLow = input.nextAvailable <= input.threshold;
  return !wasLow && isLow;
}

export interface MovementComputation {
  readonly movement: StockMovementRecord;
  readonly nextLevel: InventoryLevelRecord;
  readonly lowStockCrossed: boolean;
  readonly nextOnHand: number;
  readonly nextAvailable: number;
  readonly existingVersion: number;
}

export function computeMovementOutcome(input: {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly locationId: string;
  readonly inventoryItemId: InventoryItemId;
  readonly quantityDelta: number;
  readonly reason: StockMovementReason;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reversesStockMovementId?: string;
  readonly offeringId?: string;
  readonly variantId?: string;
  readonly note?: string;
  readonly paidVia?: StockReceiptPaidVia;
  readonly unitCost: Money | undefined;
  readonly unitCostMicros?: number;
  readonly lowStockThreshold: number;
  readonly allowNegativeStock: boolean;
  readonly existing: InventoryLevelRecord;
  readonly now: Date;
}): MovementComputation {
  const quantities = movementQuantities(input);
  const movement = buildMovementRecord(input);
  const nextLevel = buildNextInventoryLevel({
    existing: input.existing,
    nextOnHand: quantities.nextOnHand,
    nextDamaged: quantities.nextDamaged,
    averageUnitCostMicros: quantities.averageUnitCostMicros,
    nextAvailable: quantities.nextAvailable,
    threshold: input.lowStockThreshold,
    now: input.now,
  });
  return {
    movement,
    nextLevel,
    lowStockCrossed: quantities.lowStockCrossed,
    nextOnHand: quantities.nextOnHand,
    nextAvailable: quantities.nextAvailable,
    existingVersion: input.existing.version,
  };
}

function movementQuantities(input: {
  readonly inventoryItemId: InventoryItemId;
  readonly quantityDelta: number;
  readonly reason: StockMovementReason;
  readonly unitCost: Money | undefined;
  readonly unitCostMicros?: number;
  readonly paidVia?: StockReceiptPaidVia;
  readonly lowStockThreshold: number;
  readonly allowNegativeStock: boolean;
  readonly existing: InventoryLevelRecord;
}): {
  readonly nextOnHand: number;
  readonly nextDamaged: number;
  readonly nextAvailable: number;
  readonly averageUnitCostMicros: number;
  readonly lowStockCrossed: boolean;
} {
  const previousAvailable = input.existing.onHand - input.existing.reserved;
  const { onHandDelta, damagedDelta } = movementDeltas(input.reason, input.quantityDelta);
  const nextOnHand = input.existing.onHand + onHandDelta;
  const nextDamaged = input.existing.damaged + damagedDelta;
  const nextAvailable = nextOnHand - input.existing.reserved;
  assertStockAvailable({
    allowNegativeStock: input.allowNegativeStock,
    inventoryItemId: input.inventoryItemId,
    previousAvailable,
    nextOnHand,
    nextAvailable,
  });
  const averageUnitCostMicros = nextAverageUnitCostMicros({
    existing: input.existing,
    reason: input.reason,
    onHandDelta,
    unitCost: input.unitCost,
    ...(input.unitCostMicros === undefined ? {} : { unitCostMicros: input.unitCostMicros }),
  });
  const lowStockCrossed = didCrossLowStock({
    previousAvailable,
    nextAvailable,
    threshold: input.lowStockThreshold,
  });
  return { nextOnHand, nextDamaged, nextAvailable, averageUnitCostMicros, lowStockCrossed };
}

function buildMovementRecord(input: {
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
  readonly locationId: string;
  readonly inventoryItemId: InventoryItemId;
  readonly quantityDelta: number;
  readonly reason: StockMovementReason;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly reversesStockMovementId?: string;
  readonly offeringId?: string;
  readonly variantId?: string;
  readonly note?: string;
  readonly paidVia?: StockReceiptPaidVia;
  readonly unitCost: Money | undefined;
  readonly unitCostMicros?: number;
  readonly existing: InventoryLevelRecord;
  readonly now: Date;
}): StockMovementRecord {
  const { onHandDelta } = movementDeltas(input.reason, input.quantityDelta);
  const outgoingUnitCost = outgoingUnitCostForMovement({
    onHandDelta,
    existing: input.existing,
    unitCost: input.unitCost,
  });
  const unitCostMicros = costMicrosOnMovement({
    onHandDelta,
    existing: input.existing,
    unitCost: input.unitCost,
    ...(input.unitCostMicros === undefined ? {} : { unitCostMicros: input.unitCostMicros }),
  });
  return buildStockMovementDocument({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    locationId: input.locationId,
    inventoryItemId: input.inventoryItemId,
    quantityDelta: input.quantityDelta,
    reason: input.reason,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    ...(input.reversesStockMovementId === undefined
      ? {}
      : { reversesStockMovementId: input.reversesStockMovementId }),
    ...(input.offeringId === undefined ? {} : { offeringId: input.offeringId }),
    ...(input.variantId === undefined ? {} : { variantId: input.variantId }),
    ...(input.note === undefined ? {} : { note: input.note }),
    now: input.now,
    outgoingUnitCost,
    ...(unitCostMicros === undefined ? {} : { unitCostMicros }),
    ...(input.paidVia === undefined ? {} : { paidVia: input.paidVia }),
  });
}
