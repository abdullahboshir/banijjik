import { RETURN_DISPOSITION } from "@banijjik/contracts/sales";
import { STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import type { LocationId, OrderId, OrganizationId, SalesReturnId, UserId } from "@banijjik/ids";
import type { PlannedReturnLine } from "../domain/sales-return-plan.js";
import type { SalesStockLedger } from "./ports/sales-ports.js";

/**
 * Puts the restocked and damaged goods back at the cost they were sold at (plan decision 7). A
 * NOT_RECEIVED line never left the shop, so it moves nothing; a line without stock components
 * (a service) has nothing to move.
 */
export async function returnStockOfLines(input: {
  readonly stock: SalesStockLedger;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly actorUserId: UserId;
  readonly orderId: OrderId;
  readonly salesReturnId: SalesReturnId;
  readonly allowNegativeStock: boolean;
  readonly lines: readonly PlannedReturnLine[];
}): Promise<void> {
  for (const line of input.lines) {
    if (!line.drawsStock || line.disposition === RETURN_DISPOSITION.NOT_RECEIVED) continue;
    await input.stock.returnStock({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      locationId: input.locationId,
      allowNegativeStock: input.allowNegativeStock,
      sourceType: STOCK_SOURCE_TYPE.SALES_RETURN,
      sourceId: input.salesReturnId,
      lines: [{ offeringId: line.offeringId, variantId: line.variantId, quantity: line.quantity }],
      disposition: line.disposition === RETURN_DISPOSITION.DAMAGED ? "RETURN_DAMAGED" : "RETURN",
      costFrom: { sourceType: STOCK_SOURCE_TYPE.ORDER, sourceId: input.orderId },
    });
  }
}
