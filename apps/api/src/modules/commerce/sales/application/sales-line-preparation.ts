import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import type { StockComponent } from "@banijjik/contracts/catalog";
import type {
  ApprovalRequired,
  ManualDiscount,
  Money,
  QuoteLineResult,
  QuoteResponse,
} from "@banijjik/contracts/pricing";
import type { OrderTotals } from "@banijjik/contracts/sales";
import { newId } from "@banijjik/ids";
import { kindNeedsBooking, recordNotFound } from "../domain/errors.js";
import type { OrderLineProps } from "../domain/order-types.js";
import type { SalesCatalogLine } from "./ports/sales-ports.js";

/** One line as the client sends it: references and discounts, never money. */
export interface OrderLineInput {
  readonly offeringId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly modifierOptionIds: readonly string[];
  readonly manualDiscount?: ManualDiscount | undefined;
  readonly performedByMemberId?: string | null | undefined;
  readonly unitPriceOverride?: Money | undefined;
}

/** Quote result merged with the catalog facts an order line must freeze. */
export interface PreparedLines {
  readonly lines: readonly OrderLineProps[];
  readonly totals: OrderTotals;
  /** The lines that draw stock; only these reach the StockLedger. */
  readonly trackedLines: readonly {
    readonly offeringId: string;
    readonly variantId: string;
    readonly quantity: number;
  }[];
  /** Per line, what it draws from stock; the commit reads the cost through these. */
  readonly costLines: readonly {
    readonly offeringId: string;
    readonly variantId: string;
    readonly stockComponents: readonly StockComponent[];
  }[];
  /** Non-empty when a manual discount needs an approval token (ADR-121). */
  readonly approvalsRequired: readonly ApprovalRequired[];
  /**
   * What the quote actually granted by hand: the line manual discounts plus the order discount's
   * granted share (`lineDiscount - promotionDiscount` per line, 11 §3). This is the amount an
   * approval token must cover (ADR-121); it is never taken from the client.
   */
  readonly manualDiscountTotal: Money;
  /** Sum of `(listUnitPrice - unitPriceOverride) * quantity` for lines overridden below list price (A2-2). */
  readonly priceOverrideReductionTotal: Money;
}

function toTotals(quote: QuoteResponse): OrderTotals {
  const { totals } = quote;
  return {
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    // The delivery charge input stays 0 until fulfillment methods arrive (plan decision 3).
    deliveryCharge: { amount: 0, currency: totals.grandTotal.currency },
    grandTotal: totals.grandTotal,
    roundingAdjustment: totals.roundingAdjustment,
  };
}

/**
 * What the quote granted by hand, summed over the lines (ADR-121). It reads the granted
 * `lineDiscount`, not the client's request, so a discount the rules refused is never covered.
 */
function manualDiscountTotalOf(quote: QuoteResponse): Money {
  return {
    amount: quote.lines.reduce(
      (sum, line) => sum + line.lineDiscount.amount - line.promotionDiscount.amount,
      0,
    ),
    currency: quote.totals.grandTotal.currency,
  };
}

function priceOverrideReductionTotalOf(quote: QuoteResponse): Money {
  const amount = quote.lines.reduce((sum, line) => {
    const override = line.unitPriceOverride;
    if (override === null || override === undefined) return sum;
    const diff = line.listUnitPrice.amount - override.amount;
    if (diff <= 0) return sum;
    return sum + diff * line.quantity;
  }, 0);
  return { amount, currency: quote.totals.grandTotal.currency };
}

/** The frozen line: quote money plus the catalog facts that must not change under the order. */
function orderLineOf(
  catalog: SalesCatalogLine,
  quoted: QuoteLineResult,
  lineInput: OrderLineInput,
): OrderLineProps {
  return {
    orderLineId: newId(),
    offeringId: catalog.offeringId,
    variantId: catalog.variantId,
    kind: catalog.kind,
    nameSnapshot: catalog.nameSnapshot,
    quantity: quoted.quantity,
    unitPrice: quoted.unitPrice,
    listUnitPrice: quoted.listUnitPrice,
    unitPriceOverride: quoted.unitPriceOverride,
    lineGross: quoted.lineGross,
    lineDiscount: quoted.lineDiscount,
    lineTax: quoted.lineTax,
    lineNetTotal: quoted.lineNetTotal,
    unitCostSnapshot: null,
    modifiers: catalog.modifiers,
    returnedQuantity: 0,
    promotionIds: [...quoted.promotionIds],
    taxClassKey: catalog.taxClassKey,
    costComponents: catalog.kind === OFFERING_KIND.SERVICE ? [] : catalog.stockComponents,
    manualDiscount: lineInput.manualDiscount ?? null,
    performedByMemberId: lineInput.performedByMemberId ?? null,
  };
}

/**
 * Instant sales allow walk-in services without calendar holds (11 §5.3); other orders allow
 * products only. Quote lines and catalog lines share the input's order.
 */
export function prepareOrderLines(input: {
  readonly allowedKinds: readonly OfferingKind[];
  readonly quote: QuoteResponse;
  readonly catalogLines: readonly SalesCatalogLine[];
  readonly lineInputs: readonly OrderLineInput[];
}): PreparedLines {
  const lines: OrderLineProps[] = [];
  const trackedLines: { offeringId: string; variantId: string; quantity: number }[] = [];
  const costLines: {
    offeringId: string;
    variantId: string;
    stockComponents: readonly StockComponent[];
  }[] = [];
  input.lineInputs.forEach((lineInput, index) => {
    const quoted = input.quote.lines[index];
    const catalog = input.catalogLines[index];
    if (quoted === undefined || catalog === undefined) throw recordNotFound();
    if (!input.allowedKinds.includes(catalog.kind)) {
      throw kindNeedsBooking({ offeringId: catalog.offeringId, kind: catalog.kind });
    }
    const stockComponents = catalog.kind === OFFERING_KIND.SERVICE ? [] : catalog.stockComponents;
    lines.push(orderLineOf(catalog, quoted, lineInput));
    costLines.push({
      offeringId: catalog.offeringId,
      variantId: catalog.variantId,
      stockComponents,
    });
    if (stockComponents.length > 0) {
      trackedLines.push({
        offeringId: catalog.offeringId,
        variantId: catalog.variantId,
        quantity: lineInput.quantity,
      });
    }
  });
  return {
    lines,
    totals: toTotals(input.quote),
    trackedLines,
    costLines,
    approvalsRequired: input.quote.approvalsRequired,
    manualDiscountTotal: manualDiscountTotalOf(input.quote),
    priceOverrideReductionTotal: priceOverrideReductionTotalOf(input.quote),
  };
}
