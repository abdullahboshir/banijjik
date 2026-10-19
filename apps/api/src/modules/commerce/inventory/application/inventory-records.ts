import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import type { InventoryItem } from "../domain/inventory-item.entity.js";
import type { InventoryDependencies } from "./inventory-dependencies.js";

export async function recordItemCreated(
  dependencies: Pick<InventoryDependencies, "audit">,
  item: InventoryItem,
): Promise<void> {
  await dependencies.audit.record({
    action: AUDIT_ACTION.INVENTORY_ITEM_CREATED,
    entityType: AUDIT_ENTITY_TYPE.inventoryItem,
    entityId: item.inventoryItemId,
    changes: { name: { to: item.name }, baseUnitKey: { to: item.baseUnitKey } },
  });
}

export async function recordItemUpdated(
  dependencies: Pick<InventoryDependencies, "audit">,
  before: InventoryItem,
  after: InventoryItem,
): Promise<void> {
  await dependencies.audit.record({
    action: AUDIT_ACTION.INVENTORY_ITEM_UPDATED,
    entityType: AUDIT_ENTITY_TYPE.inventoryItem,
    entityId: after.inventoryItemId,
    changes: {
      ...(before.name !== after.name ? { name: { from: before.name, to: after.name } } : {}),
      ...(before.sku !== after.sku
        ? {
            sku: {
              ...(before.sku === undefined ? {} : { from: before.sku }),
              ...(after.sku === undefined ? {} : { to: after.sku }),
            },
          }
        : {}),
    },
  });
}

export async function recordItemArchived(
  dependencies: Pick<InventoryDependencies, "audit">,
  item: InventoryItem,
): Promise<void> {
  await dependencies.audit.record({
    action: AUDIT_ACTION.INVENTORY_ITEM_ARCHIVED,
    entityType: AUDIT_ENTITY_TYPE.inventoryItem,
    entityId: item.inventoryItemId,
    changes: { status: { to: item.status } },
  });
}
