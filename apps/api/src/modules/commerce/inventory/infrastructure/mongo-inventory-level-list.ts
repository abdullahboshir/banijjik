import { escapeRegExp } from "@banijjik/validation";
import { models } from "../../../../kernel/db/index.js";
import {
  INVENTORY_ITEM_MODEL_NAME,
  INVENTORY_LEVEL_MODEL_NAME,
  type InventoryItemDocument,
  type InventoryLevelDocument,
} from "./inventory.schemas.js";

type LevelWithItem = InventoryLevelDocument & {
  readonly item: InventoryItemDocument;
  readonly available: number;
};

function toInventoryLevelRow(row: LevelWithItem): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row));
}

export async function listInventoryLevelsWithItems(input: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly q?: string;
  readonly lowOnly?: boolean;
  readonly page: number;
  readonly limit: number;
}): Promise<{ readonly rows: readonly Record<string, unknown>[]; readonly total: number }> {
  const LevelModel = models({ organizationId: input.organizationId }).get<InventoryLevelDocument>(
    INVENTORY_LEVEL_MODEL_NAME,
  );
  const ItemModel = models({ organizationId: input.organizationId }).get<InventoryItemDocument>(
    INVENTORY_ITEM_MODEL_NAME,
  );
  const levels = await LevelModel.find(
    { organizationId: input.organizationId, locationId: input.locationId },
    { _id: 0 },
  ).lean();
  if (levels.length === 0) return { rows: [], total: 0 };
  const itemIds = [...new Set(levels.map((level) => level.inventoryItemId))];
  const itemFilter: Record<string, unknown> = {
    organizationId: input.organizationId,
    inventoryItemId: { $in: itemIds },
  };
  if (input.q !== undefined) {
    itemFilter.nameSearch = {
      $regex: `^${escapeRegExp(input.q.toLowerCase())}`,
    };
  }
  const items = await ItemModel.find(itemFilter, { _id: 0 }).lean();
  const itemById = new Map(items.map((item) => [item.inventoryItemId, item]));
  const joined: LevelWithItem[] = [];
  for (const level of levels) {
    const item = itemById.get(level.inventoryItemId);
    if (item === undefined) continue;
    joined.push({ ...level, item, available: level.onHand - level.reserved });
  }
  const filtered =
    input.lowOnly === true
      ? joined.filter((row) => {
          const threshold = row.item.lowStockThreshold ?? 0;
          return row.available <= threshold;
        })
      : joined;
  filtered.sort((left, right) => left.item.nameSearch.localeCompare(right.item.nameSearch));
  const total = filtered.length;
  const skip = (input.page - 1) * input.limit;
  return {
    rows: filtered.slice(skip, skip + input.limit).map(toInventoryLevelRow),
    total,
  };
}
