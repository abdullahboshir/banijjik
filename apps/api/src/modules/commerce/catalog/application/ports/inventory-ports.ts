import type { StockComponent } from "@banijjik/contracts/catalog";
import type { InventoryItemId, OrganizationId, UserId } from "@banijjik/ids";

/** Validates variant stock components against inventory items (card 3.3). Catalog never imports inventory internals. */
export interface InventoryComponentsPort {
  assertComponentsValid(
    organizationId: OrganizationId,
    components: readonly StockComponent[],
    pathPrefix: string,
  ): Promise<void>;
}

/** Creates a default tracked inventory item and links it × 1 when `catalog.defaultStockTracked` is on. */
export interface DefaultStockItemPort {
  createDefaultLinkedItem(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId;
    readonly offeringName: string;
    readonly variantName: string;
    readonly baseUnitKey: string;
  }): Promise<{ readonly inventoryItemId: InventoryItemId }>;
}
