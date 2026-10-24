import type { ManualDiscount } from "@banijjik/contracts/pricing";
import type { OrderResponse } from "@banijjik/contracts/sales";
import type { ContactLinkValue } from "@banijjik/ui";
import type { OrderLineInputBody, OrderUpdateBody } from "@banijjik/validation/sales";
import type { DiscountTypeChoice } from "./order-lines";

export interface EditValues {
  readonly contact: ContactLinkValue | null;
  readonly discountType: DiscountTypeChoice;
  readonly discountText: string;
  readonly note: string;
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

export interface UpdateBodyInput {
  readonly order: OrderResponse;
  readonly values: EditValues;
  readonly lineInputs: readonly OrderLineInputBody[];
  readonly contactId: string | null;
  readonly nextDiscount: ManualDiscount | undefined;
}

/**
 * Every line is resent with its manual discount (a re-quote from the sent lines would otherwise
 * drop it); the order discount, contact and note go only when the staff member changed them.
 */
export function updateBodyOf(input: UpdateBodyInput): OrderUpdateBody {
  const { order, values, nextDiscount } = input;
  const note = values.note.trim();
  return {
    version: order.version,
    lines: [...input.lineInputs],
    ...(contactChanged(values.contact, order) ? { contactId: input.contactId } : {}),
    ...(noteChanged(values.note, order) ? { note: note === "" ? null : note } : {}),
    ...(discountChanged(nextDiscount, order) ? { orderDiscount: nextDiscount ?? null } : {}),
  };
}
