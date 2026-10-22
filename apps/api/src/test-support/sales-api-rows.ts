/** One line as the order routes answer it. Tests read only what they assert. */
export interface OrderLineRow {
  readonly orderLineId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: string;
  readonly nameSnapshot: string;
  readonly quantity: number;
  readonly unitPrice: { amount: number; currency: string };
  readonly lineNetTotal: { amount: number; currency: string };
  readonly unitCostSnapshot: { amount: number; currency: string } | null;
  readonly taxClassKey: string | null;
  readonly promotionIds: readonly string[];
}

export interface MoneyRow {
  readonly amount: number;
  readonly currency: string;
}

export interface OrderTotalsRow {
  readonly subtotal: MoneyRow;
  readonly discountTotal: MoneyRow;
  readonly taxTotal: MoneyRow;
  readonly deliveryCharge: MoneyRow;
  readonly grandTotal: MoneyRow;
  readonly roundingAdjustment: MoneyRow;
}

/** `OrderResponse` of `@banijjik/contracts/sales`, narrowed to the fields the tests read. */
export interface OrderRow {
  readonly orderId: string;
  readonly orderNumber: string | null;
  readonly invoiceNumber: string | null;
  readonly locationId: string;
  readonly contactId: string | null;
  readonly status: string;
  readonly lines: readonly OrderLineRow[];
  readonly totals: OrderTotalsRow;
  readonly fulfillment: { readonly method: string };
  readonly paymentStatus: string;
  readonly businessDate: string;
  readonly note: string | null;
  readonly approval: { readonly approverMemberId: string; readonly action: string } | null;
  readonly version: number;
}

/** `OrderListItem`, the lean row of `GET /orders`. */
export interface OrderListItemRow {
  readonly orderId: string;
  readonly orderNumber: string | null;
  readonly status: string;
  readonly contactName: string | null;
  readonly grandTotal: MoneyRow;
  readonly paymentStatus: string;
}

export interface StockLevelRow {
  readonly inventoryItemId: string;
  readonly onHand: number;
  readonly reserved: number;
}

export interface StockMovementRow {
  readonly inventoryItemId: string;
  readonly quantityDelta: number;
  readonly reason: string;
  readonly sourceType: string;
  readonly sourceId: string;
}

/** The quote answer has no delivery charge of its own; the order totals add it. */
export interface QuoteTotalsRow {
  readonly subtotal: MoneyRow;
  readonly discountTotal: MoneyRow;
  readonly taxTotal: MoneyRow;
  readonly grandTotal: MoneyRow;
  readonly roundingAdjustment: MoneyRow;
}

export interface QuoteRow {
  readonly totals: QuoteTotalsRow;
  readonly lines: readonly {
    readonly lineGross: MoneyRow;
    readonly lineDiscount: MoneyRow;
    readonly lineTax: MoneyRow;
    readonly lineNetTotal: MoneyRow;
    readonly promotionIds: readonly string[];
  }[];
  readonly approvalsRequired: readonly { action: string; lineIndex: number }[];
}

/** A product line as an order body sends it: references and quantity, never money. */
export interface OrderLinesInput {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds?: readonly string[];
  readonly manualDiscount?: { type: string; value: number };
}

export interface StockReceiptInput {
  readonly inventoryItemId: string;
  readonly quantity: number;
  readonly unitCostAmount: number;
}

/** A product with one variant; `stockComponents` empty means the variant is not tracked. */
export interface ProductInput {
  readonly name: string;
  readonly priceAmount: number;
  readonly stockComponents?: readonly {
    readonly inventoryItemId: string;
    readonly quantity: number;
  }[];
  readonly taxClassKey?: string;
}
