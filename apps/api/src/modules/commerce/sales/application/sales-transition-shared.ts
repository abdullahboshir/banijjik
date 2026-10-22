import { STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import type { OrderId } from "@banijjik/ids";
import { locationForbidden } from "../domain/errors.js";
import type { StockLedgerReserveInput } from "./ports/sales-ports.js";

export function assertLocationAllowed(
  locationId: string,
  allowedLocationIds: readonly string[] | "ALL",
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
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
