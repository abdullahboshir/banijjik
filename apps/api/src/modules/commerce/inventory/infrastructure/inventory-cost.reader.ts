import type { StockComponent } from "@banijjik/contracts/catalog";
import type { OrganizationId } from "@banijjik/ids";
import { getActiveSession, models, sessionOption } from "../../../../kernel/db/index.js";
import { lineValueMinor } from "../domain/money-math.js";
import { INVENTORY_LEVEL_MODEL_NAME, type InventoryLevelDocument } from "./inventory.schemas.js";

export interface InventoryUnitCost {
  readonly amount: number;
  readonly currency: string;
}

interface CostLineRequest {
  readonly offeringId: string;
  readonly variantId: string;
  readonly stockComponents: readonly StockComponent[];
}

type LevelRow = Pick<
  InventoryLevelDocument,
  "inventoryItemId" | "averageUnitCostMicros" | "averageUnitCostCurrency"
>;

function costOfLine(
  line: CostLineRequest,
  byItem: ReadonlyMap<string, LevelRow>,
): InventoryUnitCost | null {
  if (line.stockComponents.length === 0) return null;
  const currency = line.stockComponents
    .map((component) => byItem.get(component.inventoryItemId)?.averageUnitCostCurrency)
    .find((value) => value !== undefined);
  if (currency === undefined) return null;
  const amount = line.stockComponents.reduce((sum, component) => {
    const row = byItem.get(component.inventoryItemId);
    return row === undefined
      ? sum
      : sum + lineValueMinor(row.averageUnitCostMicros, component.quantity);
  }, 0);
  return { amount, currency };
}

/**
 * The average cost of one sales unit per ordered variant, for the order's margin snapshot
 * (ADR-125). The conversion from cost micros stays here; sales stores the result.
 * A variant missing from the map costs `null` (no level or no stock components).
 */
export function buildInventoryCostReader(): {
  readUnitCosts(input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly lines: readonly CostLineRequest[];
  }): Promise<ReadonlyMap<string, InventoryUnitCost | null>>;
} {
  return {
    async readUnitCosts(input) {
      const inventoryItemIds = [
        ...new Set(
          input.lines.flatMap((line) =>
            line.stockComponents.map((component) => component.inventoryItemId),
          ),
        ),
      ];
      if (inventoryItemIds.length === 0) return new Map();
      const rows = await models({ organizationId: input.organizationId })
        .get<InventoryLevelDocument>(INVENTORY_LEVEL_MODEL_NAME)
        .find(
          {
            organizationId: input.organizationId,
            locationId: input.locationId,
            inventoryItemId: { $in: inventoryItemIds },
          },
          { _id: 0, inventoryItemId: 1, averageUnitCostMicros: 1, averageUnitCostCurrency: 1 },
          sessionOption(getActiveSession()),
        )
        .lean<LevelRow[]>();
      const byItem = new Map(rows.map((row) => [row.inventoryItemId, row]));
      const costs = new Map<string, InventoryUnitCost | null>();
      for (const line of input.lines) {
        costs.set(`${line.offeringId}:${line.variantId}`, costOfLine(line, byItem));
      }
      return costs;
    },
  };
}
