import { divideRoundHalfUp } from "./money-math.js";

/**
 * Moving weighted average in cost micros per base unit (ADR-069, ADR-125).
 * All arithmetic is BigInt; no float.
 */
export function nextMovingAverage(input: {
  readonly onHand: number;
  readonly averageUnitCostMicros: number;
  readonly incomingQuantity: number;
  readonly incomingUnitCostMicros: number;
}): number {
  const totalQuantity = BigInt(input.onHand) + BigInt(input.incomingQuantity);
  if (totalQuantity <= 0n) return input.incomingUnitCostMicros;
  const numerator =
    BigInt(input.onHand) * BigInt(input.averageUnitCostMicros) +
    BigInt(input.incomingQuantity) * BigInt(input.incomingUnitCostMicros);
  return Number(divideRoundHalfUp(numerator, totalQuantity));
}
