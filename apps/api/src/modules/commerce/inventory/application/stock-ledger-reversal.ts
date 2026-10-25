import { STOCK_MOVEMENT_REASON, STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import type { Money } from "@banijjik/contracts/catalog";
import type { OrganizationId, UserId } from "@banijjik/ids";
import type { InventoryDependencies } from "./inventory-dependencies.js";

export async function reverseReturnStock(
  dependencies: InventoryDependencies,
  input: {
    readonly organizationId: OrganizationId;
    readonly locationId: string;
    readonly actorUserId: UserId;
    readonly salesReturnId: string;
  },
): Promise<void> {
  const movements = await dependencies.movements.findBySource({
    organizationId: input.organizationId,
    sourceType: STOCK_SOURCE_TYPE.SALES_RETURN,
    sourceId: input.salesReturnId,
  });
  const currency = await dependencies.currency.read(input.organizationId);
  const timeZone = await dependencies.timeZone.read(input.organizationId);
  for (const movement of movements) {
    if (movement.quantityDelta <= 0) continue;
    const item = await dependencies.items.findById(movement.inventoryItemId);
    if (item === undefined) continue;
    const threshold = await dependencies.settings.lowStockThresholdForItem(
      input.organizationId,
      item.lowStockThreshold,
    );
    const movementInput = {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      locationId: input.locationId,
      inventoryItem: item,
      currency,
      timeZone,
      quantityDelta: -movement.quantityDelta,
      reason: STOCK_MOVEMENT_REASON.RETURN_REVERSAL,
      sourceType: STOCK_SOURCE_TYPE.SALES_RETURN,
      sourceId: input.salesReturnId,
      ...(movement.offeringId === undefined ? {} : { offeringId: movement.offeringId }),
      ...(movement.variantId === undefined ? {} : { variantId: movement.variantId }),
      reversesStockMovementId: movement.stockMovementId,
      lowStockThreshold: threshold,
      allowNegativeStock: false,
      ...(movement.unitCostAmount === undefined || movement.unitCostCurrency === undefined
        ? {}
        : {
            unitCost: {
              amount: movement.unitCostAmount,
              currency: movement.unitCostCurrency as Money["currency"],
            },
          }),
      ...(movement.unitCostMicros === undefined ? {} : { unitCostMicros: movement.unitCostMicros }),
    };
    await dependencies.stockLedger.applyMovement(movementInput);
  }
}
