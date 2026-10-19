import type { InventoryItemId, OrganizationId } from "@banijjik/ids";
import type { InventoryItem } from "../../domain/inventory-item.entity.js";

export interface InventoryItemListRow {
  readonly inventoryItemId: InventoryItemId;
  readonly name: string;
  readonly sku?: string;
  readonly baseUnitKey: string;
  readonly status: string;
}

export interface InventoryItemPage {
  readonly items: readonly InventoryItemListRow[];
  readonly total: number;
}

export interface InventoryItemRepository {
  insert(item: InventoryItem): Promise<void>;
  save(item: InventoryItem, expectedVersion: number): Promise<InventoryItem>;
  findById(inventoryItemId: InventoryItemId): Promise<InventoryItem | undefined>;
  list(input: {
    readonly organizationId: OrganizationId;
    readonly q?: string;
    readonly status?: string;
    readonly page: number;
    readonly limit: number;
  }): Promise<InventoryItemPage>;
  hasOnHandAnywhere(
    organizationId: OrganizationId,
    inventoryItemId: InventoryItemId,
  ): Promise<boolean>;
}
