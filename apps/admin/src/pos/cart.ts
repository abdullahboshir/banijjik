/**
 * The till cart (card 3.9 B). It holds what the cashier picked, never prices: the API quotes every
 * sale (plan 3.9 decision 14), so the total on screen is only a preview until the server answers.
 */
export interface CartLine {
  readonly lineKey: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly offeringName: string;
  readonly variantName: string;
  readonly quantity: number;
}

export interface CartState {
  readonly lines: readonly CartLine[];
}

export type CartAction =
  | {
      readonly type: "add";
      readonly line: Omit<CartLine, "lineKey" | "quantity">;
      readonly quantity?: number;
    }
  | { readonly type: "setQuantity"; readonly lineKey: string; readonly quantity: number }
  | { readonly type: "remove"; readonly lineKey: string }
  | { readonly type: "clear" };

export const EMPTY_CART: CartState = Object.freeze({ lines: [] });

/** A line is one variant: scanning the same barcode again adds to its quantity, never a second line. */
export function lineKeyOf(variantId: string): string {
  return `variant:${variantId}`;
}

const DEFAULT_ADD_QUANTITY = 1;

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
  if (action.quantity < 1) return removeLine(state, action.lineKey);
  return replaceQuantity(state, action.lineKey, action.quantity);
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
