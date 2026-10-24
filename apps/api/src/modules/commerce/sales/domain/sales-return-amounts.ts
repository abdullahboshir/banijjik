/**
 * Money of a sales return (plan 3.5b decision 4). Everything is integer minor units. A part is the
 * cumulative share of the line, so the returns of one line always add up to the line total and
 * the last unit takes the remainder (no drift from rounding).
 */

/** The share of `totalMinor` that the first `quantityAfter` of `sold` units carry. */
export function cumulativeShareMinor(
  totalMinor: number,
  sold: number,
  quantityAfter: number,
): number {
  if (quantityAfter >= sold) return totalMinor;
  return Math.floor((totalMinor * quantityAfter) / sold);
}

export interface ReturnLineShare {
  /** Value of the goods returned now, from the line's net total. */
  readonly valueMinor: number;
  /** The tax inside `valueMinor`, split the same way. */
  readonly taxPartMinor: number;
}

export interface LineSharePlanInput {
  readonly soldQuantity: number;
  readonly returnedBefore: number;
  readonly quantity: number;
  readonly lineNetTotalMinor: number;
  readonly lineTaxMinor: number;
}

/** The value and tax of `quantity` more units, given what the order line already returned. */
export function returnLineShare(input: LineSharePlanInput): ReturnLineShare {
  const { soldQuantity, returnedBefore, quantity, lineNetTotalMinor, lineTaxMinor } = input;
  const returnedAfter = returnedBefore + quantity;
  const valueMinor =
    cumulativeShareMinor(lineNetTotalMinor, soldQuantity, returnedAfter) -
    cumulativeShareMinor(lineNetTotalMinor, soldQuantity, returnedBefore);
  const taxPartMinor =
    cumulativeShareMinor(lineTaxMinor, soldQuantity, returnedAfter) -
    cumulativeShareMinor(lineTaxMinor, soldQuantity, returnedBefore);
  return { valueMinor, taxPartMinor };
}

/**
 * The delivery charge this return gives back. Only a return that asks for it returns the charge
 * still held by the order, so an earlier return of the same charge is never counted twice.
 */
export function deliveryChargeReturnedMinor(input: {
  readonly returnDeliveryCharge: boolean;
  readonly orderDeliveryChargeMinor: number;
  readonly deliveryReturnedBeforeMinor: number;
}): number {
  if (!input.returnDeliveryCharge) return 0;
  return Math.max(0, input.orderDeliveryChargeMinor - input.deliveryReturnedBeforeMinor);
}

/**
 * The rounding adjustment (signed) goes back only with the return that empties the order, so a
 * fully returned order owes exactly the delivery charge it kept (plan decision 4).
 */
export function roundingReturnedMinor(input: {
  readonly everyLineFullyReturned: boolean;
  readonly roundingAdjustmentMinor: number;
}): number {
  return input.everyLineFullyReturned ? input.roundingAdjustmentMinor : 0;
}
