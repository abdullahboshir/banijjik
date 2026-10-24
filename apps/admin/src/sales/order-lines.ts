import type {
  ModifierGroupResponse,
  OfferingResponse,
  VariantResponse,
} from "@banijjik/contracts/catalog";
import {
  MANUAL_DISCOUNT_TYPE,
  type ManualDiscount,
  type ManualDiscountType,
  type QuoteLineInput,
  type QuoteResponse,
} from "@banijjik/contracts/pricing";
import type { OrderResponse } from "@banijjik/contracts/sales";
import type { OrderLineInputBody } from "@banijjik/validation/sales";
import { parseMoneyInput } from "@banijjik/ui";

export type DiscountTypeChoice = ManualDiscountType | "NONE";

export interface OrderLineDraft {
  readonly draftId: string;
  readonly offering: OfferingResponse | undefined;
  readonly variantId: string;
  readonly quantity: string;
  readonly modifierOptionIds: readonly string[];
  readonly discountType: DiscountTypeChoice;
  readonly discountText: string;
  /** Who performed the line; commission accrues to them (plan 3.11 Refresh C). Null: nobody chosen. */
  readonly performedByMemberId: string | null;
}

export type LineParse =
  | { readonly kind: "ok"; readonly input: OrderLineInputBody }
  | { readonly kind: "empty" }
  | { readonly kind: "invalid"; readonly field: "quantity" | "discount" };

const BENGALI_ZERO = "০".charCodeAt(0);
const MAX_PERCENT_BASIS_POINTS = 10_000;

export function emptyOrderLine(draftId: string): OrderLineDraft {
  return {
    draftId,
    offering: undefined,
    variantId: "",
    quantity: "",
    modifierOptionIds: [],
    discountType: "NONE",
    discountText: "",
    performedByMemberId: null,
  };
}

export function variantOf(draft: OrderLineDraft): VariantResponse | undefined {
  if (draft.offering === undefined) return undefined;
  return (
    draft.offering.variants.find((variant) => variant.variantId === draft.variantId) ??
    draft.offering.variants[0]
  );
}

function latinDigits(text: string): string {
  return text.trim().replace(/[০-৯]/gu, (digit) => String(digit.charCodeAt(0) - BENGALI_ZERO));
}

/** A whole number of the sales unit, respecting the variant's minimum and step. */
export function parseLineQuantity(
  text: string,
  rule: VariantResponse["quantityRule"],
): number | undefined {
  const digits = latinDigits(text);
  if (!/^\d+$/u.test(digits)) return undefined;
  const quantity = Number(digits);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return undefined;
  if (rule === null) return quantity;
  if (quantity < rule.min) return undefined;
  if (rule.max !== undefined && quantity > rule.max) return undefined;
  return (quantity - rule.min) % rule.step === 0 ? quantity : undefined;
}

/** PERCENT is basis points (10% = 1000), AMOUNT is minor units. */
export function parseManualDiscount(
  type: DiscountTypeChoice,
  text: string,
): ManualDiscount | undefined {
  if (type === "NONE") return undefined;
  const parsed = parseMoneyInput(text, 2);
  if (parsed === undefined || parsed.minorUnits <= 0) return undefined;
  if (type === MANUAL_DISCOUNT_TYPE.PERCENT && parsed.minorUnits > MAX_PERCENT_BASIS_POINTS) {
    return undefined;
  }
  return { type, value: parsed.minorUnits };
}

export function discountToText(discount: ManualDiscount | null): {
  readonly type: DiscountTypeChoice;
  readonly text: string;
} {
  if (discount === null) return { type: "NONE", text: "" };
  const major = Math.floor(discount.value / 100);
  const minor = discount.value % 100;
  const text = minor === 0 ? String(major) : `${major}.${String(minor).padStart(2, "0")}`;
  return { type: discount.type, text };
}

/** The line as the API takes it; `empty` means no product has been picked yet. */
export function parseLineDraft(draft: OrderLineDraft): LineParse {
  const variant = variantOf(draft);
  if (draft.offering === undefined || variant === undefined) return { kind: "empty" };
  const quantity = parseLineQuantity(draft.quantity, variant.quantityRule);
  if (quantity === undefined) return { kind: "invalid", field: "quantity" };
  const manualDiscount = parseManualDiscount(draft.discountType, draft.discountText);
  if (draft.discountType !== "NONE" && manualDiscount === undefined) {
    return { kind: "invalid", field: "discount" };
  }
  return {
    kind: "ok",
    input: {
      offeringId: draft.offering.offeringId,
      variantId: variant.variantId,
      quantity,
      modifierOptionIds: [...draft.modifierOptionIds],
      ...(manualDiscount === undefined ? {} : { manualDiscount }),
      ...(draft.performedByMemberId === null
        ? {}
        : { performedByMemberId: draft.performedByMemberId }),
    },
  };
}

/** Every picked and valid line, in the order the person arranged them. */
export function lineInputsOfDrafts(drafts: readonly OrderLineDraft[]): OrderLineInputBody[] {
  const inputs: OrderLineInputBody[] = [];
  for (const draft of drafts) {
    const parsed = parseLineDraft(draft);
    if (parsed.kind === "ok") inputs.push(parsed.input);
  }
  return inputs;
}

export function quoteLinesOf(inputs: readonly OrderLineInputBody[]): QuoteLineInput[] {
  return inputs.map((input) => ({
    offeringId: input.offeringId,
    variantId: input.variantId,
    quantity: input.quantity,
    modifierOptionIds: input.modifierOptionIds,
    ...(input.manualDiscount === undefined ? {} : { manualDiscount: input.manualDiscount }),
  }));
}

/** The manual discount only: promotions are not part of what the approver signs off. */
export function manualDiscountTotalOf(quote: QuoteResponse | undefined): number {
  if (quote === undefined) return 0;
  return quote.lines.reduce((total, line) => total + line.manualDiscount.amount, 0);
}

/** The stored lines as edit inputs: an edit must resend every manual discount (Amendment 1). */
export function storedLineInputs(order: OrderResponse): OrderLineInputBody[] {
  return order.lines.map((line) => ({
    offeringId: line.offeringId,
    variantId: line.variantId,
    quantity: line.quantity,
    modifierOptionIds: line.modifiers.map((modifier) => modifier.modifierOptionId),
    ...(line.manualDiscount === null ? {} : { manualDiscount: line.manualDiscount }),
    ...(line.performedByMemberId === null ? {} : { performedByMemberId: line.performedByMemberId }),
  }));
}

export function modifierGroupsOf(
  offering: OfferingResponse,
  groups: readonly ModifierGroupResponse[],
): ModifierGroupResponse[] {
  const wanted = new Set(offering.modifierGroups.map((group) => group.referenceId));
  return groups.filter((group) => wanted.has(group.modifierGroupId));
}

export function requiredGroupMissing(
  groups: readonly ModifierGroupResponse[],
  selectedOptionIds: readonly string[],
): boolean {
  return groups.some(
    (group) =>
      group.isRequired &&
      group.options.filter((option) => selectedOptionIds.includes(option.modifierOptionId)).length <
        Math.max(1, group.minSelect),
  );
}

export function lineGrossOf(
  variant: VariantResponse,
  modifiers: readonly { priceDelta: { amount: number } }[],
  quantity: number,
): number {
  const unit = modifiers.reduce((total, modifier) => total + modifier.priceDelta.amount, 0);
  return (variant.price.amount + unit) * quantity;
}
