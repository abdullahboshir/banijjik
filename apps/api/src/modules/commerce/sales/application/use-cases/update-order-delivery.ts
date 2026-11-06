import { FULFILLMENT_METHOD, ORDER_STATUS, type FulfillmentMethod } from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import type { ContactId } from "@banijjik/ids";
import { contactPhoneRequired, orderNeedsLine, recordNotFound } from "../../domain/errors.js";
import type { Order } from "../../domain/order.entity.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import {
  assertAddressAllowedForMethod,
  assertDeliveryAddressPresent,
  isDeliveryFulfillment,
  resolveFulfillmentMethod,
} from "../sales-transition-shared.js";
import type { EditArgs, UpdateBody } from "./update-order-types.js";

export function linesChangedOf(body: UpdateBody): boolean {
  return body.lines !== undefined || body.orderDiscount !== undefined;
}

export function priceInputsChangedOf(body: UpdateBody): boolean {
  return (
    linesChangedOf(body) ||
    body.deliveryAddress !== undefined ||
    body.fulfillmentMethod !== undefined
  );
}

export function nextDeliveryAddressOf(
  existing: Order,
  body: UpdateBody,
  nextMethod: FulfillmentMethod,
): DeliveryAddress | null {
  if (!isDeliveryFulfillment(nextMethod)) {
    return body.deliveryAddress === undefined ? null : body.deliveryAddress;
  }
  return body.deliveryAddress === undefined ? existing.deliveryAddress : body.deliveryAddress;
}

export function assertDeliveryEdit(existing: Order, body: UpdateBody): void {
  const nextMethod =
    body.fulfillmentMethod === undefined
      ? existing.fulfillment.method
      : resolveFulfillmentMethod(body.fulfillmentMethod, FULFILLMENT_METHOD.PICKUP);
  const nextAddress = nextDeliveryAddressOf(existing, body, nextMethod);
  assertAddressAllowedForMethod(nextMethod, nextAddress);
  if (existing.status === ORDER_STATUS.DRAFT) return;
  assertDeliveryAddressPresent(nextMethod, nextAddress);
}

export async function assertContentOfPlacedOrder(
  dependencies: SalesDependencies,
  args: EditArgs,
  contactId: ContactId | null | undefined,
): Promise<void> {
  const { existing } = args;
  if (existing.status === ORDER_STATUS.DRAFT) return;
  if (args.prepared === undefined && linesChangedOf(args.input.body)) throw orderNeedsLine();
  const nextMethod = args.input.body.fulfillmentMethod ?? existing.fulfillment.method;
  if (nextMethod !== FULFILLMENT_METHOD.PICKUP) return;
  const nextContactId = contactId === undefined ? existing.contactId : contactId;
  if (nextContactId === null) throw contactPhoneRequired("");
  const contact = await dependencies.contacts.findActive(nextContactId);
  if (contact === undefined) throw recordNotFound();
  if (contact.phoneE164 === null) throw contactPhoneRequired(nextContactId);
}
