import { OFFERING_KIND } from "@banijjik/contracts";
import type { StockComponent } from "@banijjik/contracts/catalog";
import type { ApprovalRequired, ManualDiscount, QuoteResponse } from "@banijjik/contracts/pricing";
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
 * Only PRODUCT-kind offerings are sold here; SERVICE, PLAN, RENTAL and EVENT lines go to
 * bookings and enrollments (11 §5.5). Quote lines and catalog lines share the input's order.
 */
export function prepareOrderLines(input: {
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
    if (catalog.kind !== OFFERING_KIND.PRODUCT) {
      throw kindNeedsBooking({ offeringId: catalog.offeringId, kind: catalog.kind });
    }
    lines.push({
      orderLineId: newId(),
      offeringId: catalog.offeringId,
      variantId: catalog.variantId,
      kind: catalog.kind,
      nameSnapshot: catalog.nameSnapshot,
      quantity: quoted.quantity,
      unitPrice: quoted.unitPrice,
      lineGross: quoted.lineGross,
      lineDiscount: quoted.lineDiscount,
      lineTax: quoted.lineTax,
      lineNetTotal: quoted.lineNetTotal,
      unitCostSnapshot: null,
      modifiers: catalog.modifiers,
      returnedQuantity: 0,
      promotionIds: [...quoted.promotionIds],
      taxClassKey: catalog.taxClassKey,
      costComponents: catalog.stockComponents,
      manualDiscount: lineInput.manualDiscount ?? null,
    });
    costLines.push({
      offeringId: catalog.offeringId,
      variantId: catalog.variantId,
      stockComponents: catalog.stockComponents,
    });
    if (catalog.stockComponents.length > 0) {
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
  };
}
