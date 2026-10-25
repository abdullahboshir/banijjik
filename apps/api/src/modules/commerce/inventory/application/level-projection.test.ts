import { STOCK_MOVEMENT_REASON, STOCK_STATE } from "@banijjik/contracts/inventory";
import {
  asId,
  newId,
  type InventoryItemId,
  type OrganizationId,
  type StockMovementId,
} from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { projectLevelsFromMovements } from "./level-projection.js";
import type { StockMovementRecord } from "./ports/stock-records.js";

function movement(
  partial: Partial<StockMovementRecord> &
    Pick<StockMovementRecord, "quantityDelta" | "reason" | "stockMovementId">,
): StockMovementRecord {
  return {
    organizationId: asId<OrganizationId>("01900000-0000-7000-8000-000000000001"),
    locationId: "loc-1",
    inventoryItemId: asId<InventoryItemId>("01900000-0000-7000-8000-000000000002"),
    stockState: STOCK_STATE.SELLABLE,
    sourceType: "ADJUSTMENT",
    sourceId: "src-1",
    occurredAt: new Date("2026-01-01T00:00:00.000Z"),
    businessDate: "2026-01-01",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    createdByUserId: asId("01900000-0000-7000-8000-000000000003"),
    updatedByUserId: asId("01900000-0000-7000-8000-000000000003"),
    ...partial,
  };
}

describe("projectLevelsFromMovements", () => {
  it("mirrors a reversing adjustment back to zero on-hand", () => {
    const purchaseId = newId<StockMovementId>();
    const reverseId = newId<StockMovementId>();
    const map = projectLevelsFromMovements([
      movement({
        stockMovementId: purchaseId,
        quantityDelta: 100,
        reason: STOCK_MOVEMENT_REASON.PURCHASE,
        unitCostMicros: 500_000,
      }),
      movement({
        stockMovementId: reverseId,
        quantityDelta: -100,
        reason: STOCK_MOVEMENT_REASON.ADJUSTMENT,
        reversesStockMovementId: purchaseId,
      }),
    ]);
    const level = map.get("loc-1:01900000-0000-7000-8000-000000000002");
    expect(level?.onHand).toBe(0);
    expect(level?.damaged).toBe(0);
  });

  it("a damaged return and its reversal leave sellable stock untouched and net damaged to zero", () => {
    const returnedId = newId<StockMovementId>();
    const map = projectLevelsFromMovements([
      movement({
        stockMovementId: returnedId,
        quantityDelta: 2,
        reason: STOCK_MOVEMENT_REASON.RETURN_DAMAGED,
      }),
      movement({
        stockMovementId: newId<StockMovementId>(),
        quantityDelta: -2,
        reason: STOCK_MOVEMENT_REASON.RETURN_DAMAGED_REVERSAL,
        reversesStockMovementId: returnedId,
      }),
    ]);
    const level = map.get("loc-1:01900000-0000-7000-8000-000000000002");
    expect(level?.onHand).toBe(0);
    expect(level?.damaged).toBe(0);
  });
});
