import type { ManualDiscount } from "@banijjik/contracts/pricing";
import type { OrderResponse } from "@banijjik/contracts/sales";
import type { DeliveryAddress } from "@banijjik/contracts/sales/delivery";
import type { ContactLinkValue } from "@banijjik/ui";
import { normalizePhoneToE164 } from "@banijjik/validation";
import type { OrderLineInputBody, OrderUpdateBody } from "@banijjik/validation/sales";
import type { AdminDeliveryAddress } from "./new-order-submit";
import type { DiscountTypeChoice } from "./order-lines";

export interface EditValues {
  readonly contact: ContactLinkValue | null;
  readonly discountType: DiscountTypeChoice;
  readonly discountText: string;
  readonly note: string;
  readonly deliveryAddress?: AdminDeliveryAddress | null;
}

export interface EditErrors {
  readonly message: string | undefined;
  readonly totals: string | undefined;
  readonly contact: string | undefined;
}

export const NO_EDIT_ERRORS: EditErrors = {
  message: undefined,
  totals: undefined,
  contact: undefined,
};

function contactChanged(contact: ContactLinkValue | null, order: OrderResponse): boolean {
  if (contact === null) return order.contactId !== null;
  if (typeof contact === "string") return contact !== order.contactId;
  return true;
}

function noteChanged(note: string, order: OrderResponse): boolean {
  return note.trim() !== (order.note ?? "");
}

function discountChanged(next: ManualDiscount | undefined, order: OrderResponse): boolean {
  return JSON.stringify(next ?? null) !== JSON.stringify(order.orderDiscount);
}

function isSameAddress(
  next: AdminDeliveryAddress,
  cur: DeliveryAddress,
): boolean {
  const phone = normalizePhoneToE164(next.phone) ?? next.phone.trim();
  const postal = next.postalCode?.trim() || null;
  return (
    next.recipientName.trim() === cur.recipientName &&
    phone === cur.phoneE164 &&
    next.addressLine.trim() === cur.addressLine &&
    next.districtCode.trim() === cur.districtCode &&
    next.areaCode.trim() === cur.areaCode &&
    postal === cur.postalCode
  );
}

function addressChanged(
  address: AdminDeliveryAddress | null | undefined,
  order: OrderResponse,
): boolean {
  if (address === undefined) return false;
  const cur = order.delivery?.address;
  if (!address && !cur) return false;
  if (!address || !cur) return true;
  return !isSameAddress(address, cur);
}

export interface UpdateBodyInput {
  readonly order: OrderResponse;
  readonly values: EditValues;
  readonly lineInputs: readonly OrderLineInputBody[];
  readonly contactId: string | null;
  readonly nextDiscount: ManualDiscount | undefined;
}

function resolveUpdatedDeliveryAddress(
  address: AdminDeliveryAddress | null | undefined,
  order: OrderResponse,
): DeliveryAddress | null | undefined {
  if (!addressChanged(address, order)) return undefined;
  if (!address || !address.recipientName.trim()) return null;
  return {
    recipientName: address.recipientName.trim(),
    phoneE164: normalizePhoneToE164(address.phone) ?? address.phone.trim(),
    addressLine: address.addressLine.trim(),
    districtCode: address.districtCode.trim(),
    areaCode: address.areaCode.trim(),
    postalCode: address.postalCode?.trim() || null,
  };
}

/**
 * Every line is resent with its manual discount (a re-quote from the sent lines would otherwise
 * drop it); the order discount, contact and note go only when the staff member changed them.
 */
export function updateBodyOf(input: UpdateBodyInput): OrderUpdateBody {
  const { order, values, nextDiscount } = input;
  const note = values.note.trim();
  const deliveryAddress = resolveUpdatedDeliveryAddress(values.deliveryAddress, order);

  return {
    version: order.version,
    lines: [...input.lineInputs],
    ...(contactChanged(values.contact, order) ? { contactId: input.contactId } : {}),
    ...(noteChanged(values.note, order) ? { note: note === "" ? null : note } : {}),
    ...(discountChanged(nextDiscount, order) ? { orderDiscount: nextDiscount ?? null } : {}),
    ...(deliveryAddress !== undefined ? { deliveryAddress } : {}),
  };
}
