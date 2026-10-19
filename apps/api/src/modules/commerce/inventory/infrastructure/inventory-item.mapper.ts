import { asId, type InventoryItemId, type OrganizationId, type UserId } from "@banijjik/ids";
import { InventoryItem } from "../domain/inventory-item.entity.js";
import { foldName } from "../domain/name-search.js";
import type { InventoryItemDocument } from "./inventory.schemas.js";

export function toInventoryItem(document: InventoryItemDocument): InventoryItem {
  return InventoryItem.restore({
    inventoryItemId: asId<InventoryItemId>(document.inventoryItemId),
    organizationId: asId<OrganizationId>(document.organizationId),
    name: document.name,
    ...(document.sku === undefined ? {} : { sku: document.sku }),
    baseUnitKey: document.baseUnitKey,
    ...(document.lowStockThreshold === undefined
      ? {}
      : { lowStockThreshold: document.lowStockThreshold }),
    status: document.status,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    createdByUserId: document.createdByUserId ? asId<UserId>(document.createdByUserId) : null,
    updatedByUserId: document.updatedByUserId ? asId<UserId>(document.updatedByUserId) : null,
  });
}

export function toInventoryItemDocument(item: InventoryItem): InventoryItemDocument {
  return {
    inventoryItemId: item.inventoryItemId,
    organizationId: item.organizationId,
    name: item.name,
    nameSearch: foldName(item.name),
    ...(item.sku === undefined ? {} : { sku: item.sku }),
    baseUnitKey: item.baseUnitKey,
    ...(item.lowStockThreshold === undefined ? {} : { lowStockThreshold: item.lowStockThreshold }),
    status: item.status,
    version: item.version,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdByUserId: item.createdByUserId,
    updatedByUserId: item.updatedByUserId,
  };
}
