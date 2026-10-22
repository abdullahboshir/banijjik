import { STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import type { FulfillmentMethod } from "@banijjik/contracts/sales";
import type { OrderId } from "@banijjik/ids";
import { fulfillmentMethodUnsupported, locationForbidden } from "../domain/errors.js";
import type { StockLedgerReserveInput } from "./ports/sales-ports.js";

export function assertLocationAllowed(
  locationId: string,
  allowedLocationIds: readonly string[] | "ALL",
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
}

/**
 * The method of the order, or the business rule. A draft hands over by pickup and a counter sale
 * hands over now, so each path serves exactly one method; COURIER and OWN_RIDER stay declared
 * until Phase 5 (plan decision 1).
 */
export function resolveFulfillmentMethod(
  requested: FulfillmentMethod | undefined,
  served: FulfillmentMethod,
): FulfillmentMethod {
  if (requested === undefined) return served;
  if (requested !== served) throw fulfillmentMethodUnsupported(requested);
  return requested;
}

export function formatOrderNumber(value: number): string {
  return String(value).padStart(6, "0");
}

export function formatInvoiceNumber(value: number): string {
  return String(value).padStart(6, "0");
}

export function orderOrderingKey(orderId: OrderId): string {
  return `order:${orderId}`;
}

/** The reservation key is `(ORDER, orderId)`, so a retried place never reserves twice. */
export function stockInputOf(input: {
  readonly organizationId: StockLedgerReserveInput["organizationId"];
  readonly locationId: string;
  readonly actorUserId: StockLedgerReserveInput["actorUserId"];
  readonly orderId: OrderId;
  readonly lines: readonly {
    readonly offeringId: string;
    readonly variantId: string;
    readonly quantity: number;
  }[];
  readonly allowNegativeStock: boolean;
}): StockLedgerReserveInput {
  return {
    organizationId: input.organizationId,
    locationId: input.locationId,
    actorUserId: input.actorUserId,
    sourceType: STOCK_SOURCE_TYPE.ORDER,
    sourceId: input.orderId,
    lines: input.lines.map((line) => ({
      offeringId: line.offeringId,
      variantId: line.variantId,
      quantity: line.quantity,
    })),
    allowNegativeStock: input.allowNegativeStock,
  };
}
