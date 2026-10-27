/**
 * The till cart (card 3.9 B). It holds what the cashier picked, never prices: the API quotes every
 * sale (plan 3.9 decision 14), so the total on screen is only a preview until the server answers.
 */
import { OFFERING_KIND } from "@banijjik/contracts";

export interface CartLine {
  readonly lineKey: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: string;
  readonly offeringName: string;
  readonly variantName: string;
  readonly quantity: number;
  /** Who performed a service line; null on products and when the cashier leaves it blank. */
  readonly performedByMemberId: string | null;
  /** Display name of that member, kept so the receipt can print it without another round trip. */
  readonly performerName: string | null;
}

export interface CartState {
  readonly lines: readonly CartLine[];
}

export type QuantityControl = "stepper" | "weightKeypad";

export type CartAction =
  | {
      readonly type: "add";
      readonly line: Omit<CartLine, "lineKey" | "quantity">;
      readonly quantity?: number;
    }
  | { readonly type: "setQuantity"; readonly lineKey: string; readonly quantity: number }
  | {
      readonly type: "setPerformer";
      readonly lineKey: string;
      readonly performedByMemberId: string | null;
      readonly performerName: string | null;
    }
  | { readonly type: "remove"; readonly lineKey: string }
  | { readonly type: "clear" };

export const EMPTY_CART: CartState = Object.freeze({ lines: [] });

/** A line is one variant: scanning the same barcode again adds to its quantity, never a second line. */
export function lineKeyOf(variantId: string): string {
  return `variant:${variantId}`;
}

const DEFAULT_ADD_QUANTITY = 1;

const QUANTITY_CONTROL_BY_KIND: Readonly<Record<string, QuantityControl>> = {
  [OFFERING_KIND.SERVICE]: "stepper",
};

/**
 * A service always uses a whole-number stepper. A weight keypad for loose goods is out of scope
 * (card 3.42 leftovers), so every till line uses the stepper today.
 */
export function quantityControlOf(line: Pick<CartLine, "kind">): QuantityControl {
  return QUANTITY_CONTROL_BY_KIND[line.kind] ?? "stepper";
}

export function usesWeightKeypad(line: Pick<CartLine, "kind">): boolean {
  if (line.kind === OFFERING_KIND.SERVICE) return false;
  return quantityControlOf(line) === "weightKeypad";
}

function addLine(state: CartState, action: Extract<CartAction, { type: "add" }>): CartState {
  const addedQuantity = action.quantity ?? DEFAULT_ADD_QUANTITY;
  const lineKey = lineKeyOf(action.line.variantId);
  const existing = state.lines.find((line) => line.lineKey === lineKey);
  if (!existing) {
    return { lines: [...state.lines, { ...action.line, lineKey, quantity: addedQuantity }] };
  }
  return replaceQuantity(state, lineKey, existing.quantity + addedQuantity);
}

function replaceQuantity(state: CartState, lineKey: string, quantity: number): CartState {
  return {
    lines: state.lines.map((line) => (line.lineKey === lineKey ? { ...line, quantity } : line)),
  };
}

/** A quantity below one removes the line: a zero-quantity line would be sent to the API by mistake. */
function setLineQuantity(
  state: CartState,
  action: Extract<CartAction, { type: "setQuantity" }>,
): CartState {
  const current = state.lines.find((line) => line.lineKey === action.lineKey);
  const nextQuantity =
    current !== undefined && quantityControlOf(current) === "stepper"
      ? Math.trunc(action.quantity)
      : action.quantity;
  if (nextQuantity < 1) return removeLine(state, action.lineKey);
  return replaceQuantity(state, action.lineKey, nextQuantity);
}

function setPerformer(
  state: CartState,
  action: Extract<CartAction, { type: "setPerformer" }>,
): CartState {
  return {
    lines: state.lines.map((line) =>
      line.lineKey === action.lineKey
        ? {
            ...line,
            performedByMemberId: action.performedByMemberId,
            performerName: action.performerName,
          }
        : line,
    ),
  };
}

function removeLine(state: CartState, lineKey: string): CartState {
  return { lines: state.lines.filter((line) => line.lineKey !== lineKey) };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add":
      return addLine(state, action);
    case "setQuantity":
      return setLineQuantity(state, action);
    case "setPerformer":
      return setPerformer(state, action);
    case "remove":
      return removeLine(state, action.lineKey);
    case "clear":
      return EMPTY_CART;
  }
}

/** Total quantity across lines, for the cart badge. Integer math only. */
export function cartItemCount(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Member id to display name for the receipt; unknown or blank performers are omitted. */
export function performerNamesOf(lines: readonly CartLine[]): Readonly<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const line of lines) {
    if (line.performedByMemberId === null || line.performerName === null) continue;
    names[line.performedByMemberId] = line.performerName;
  }
  return names;
}
