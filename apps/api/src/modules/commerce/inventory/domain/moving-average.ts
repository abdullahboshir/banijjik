/**
 * Moving weighted average in minor units per base unit (ADR-069), rounded half up.
 */
export function nextMovingAverage(input: {
  readonly onHand: number;
  readonly averageUnitCostMinor: number;
  readonly incomingQuantity: number;
  readonly incomingUnitCostMinor: number;
}): number {
  const { onHand, averageUnitCostMinor, incomingQuantity, incomingUnitCostMinor } = input;
  const totalQuantity = onHand + incomingQuantity;
  if (totalQuantity <= 0) return incomingUnitCostMinor;
  const numerator = onHand * averageUnitCostMinor + incomingQuantity * incomingUnitCostMinor;
  return Math.round(numerator / totalQuantity);
}
