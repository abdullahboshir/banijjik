import { STOCK_SOURCE_TYPE } from "@banijjik/contracts/inventory";
import { FULFILLMENT_METHOD, type FulfillmentMethod } from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import type { OrderId } from "@banijjik/ids";
import {
  addressNotAllowedForMethod,
  deliveryAddressRequired,
  fulfillmentMethodUnsupported,
  locationForbidden,
} from "../domain/errors.js";
import type { StockLedgerReserveInput } from "./ports/sales-ports.js";

const COUNTER_DRAFT_METHODS: readonly FulfillmentMethod[] = [
  FULFILLMENT_METHOD.PICKUP,
  FULFILLMENT_METHOD.COURIER,
  FULFILLMENT_METHOD.OWN_RIDER,
];

export function isDeliveryFulfillment(method: string): boolean {
  return method === FULFILLMENT_METHOD.COURIER || method === FULFILLMENT_METHOD.OWN_RIDER;
}

export function assertAddressAllowedForMethod(
  method: FulfillmentMethod,
  address: DeliveryAddress | null | undefined,
): void {
  if (address != null && !isDeliveryFulfillment(method)) {
    throw addressNotAllowedForMethod(method);
  }
}

export function assertDeliveryAddressPresent(
  method: FulfillmentMethod,
  address: DeliveryAddress | null,
): void {
  if (isDeliveryFulfillment(method) && address === null) throw deliveryAddressRequired();
}

export function assertLocationAllowed(
  locationId: string,
  allowedLocationIds: readonly string[] | "ALL",
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
}

/**
 * A draft serves pickup or delivery; an instant sale serves INSTANT only. Admin create refuses
 * INSTANT (`FULFILLMENT_METHOD_UNSUPPORTED`); the instant path refuses every other method.
 */
export function resolveFulfillmentMethod(
  requested: FulfillmentMethod | undefined,
  served: FulfillmentMethod,
): FulfillmentMethod {
  const method = requested ?? served;
  if (served === FULFILLMENT_METHOD.INSTANT) {
    if (method !== FULFILLMENT_METHOD.INSTANT) throw fulfillmentMethodUnsupported(method);
    return method;
  }
  if (!COUNTER_DRAFT_METHODS.includes(method)) throw fulfillmentMethodUnsupported(method);
  return method;
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
