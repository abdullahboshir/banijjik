import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";

/** Minor units × this = cost micros per base unit (ADR-125). */
export const COST_MICROS_PER_MINOR = 10_000n;

/**
 * Integer division with round-half-up (away from zero on .5).
 * Pricing will share this pattern; kept local until a shared money package exists.
 */
export function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError("division by zero");
  }
  if (numerator === 0n) return 0n;
  const negative = numerator < 0n !== denominator < 0n;
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded = remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

export function minorToMicros(minorUnits: number): number {
  return Number(BigInt(minorUnits) * COST_MICROS_PER_MINOR);
}

export function microsToMinor(costMicros: number): number {
  return Number(divideRoundHalfUp(BigInt(costMicros), COST_MICROS_PER_MINOR));
}

/** Line value in minor units: (costMicros × quantity) / 10000, half up once. */
export function lineValueMinor(costMicros: number, quantity: number): number {
  if (!Number.isInteger(quantity)) {
    throw new DomainRuleError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.non_integer_quantity",
    });
  }
  const numerator = BigInt(costMicros) * BigInt(quantity);
  return Number(divideRoundHalfUp(numerator, COST_MICROS_PER_MINOR));
}

/** Computes the value in minor units of a movement using unitCostMicros or unitCostAmount. */
export function movementValue(movement: {
  readonly quantityDelta: number;
  readonly unitCostMicros?: number;
  readonly unitCostAmount?: number;
}): number {
  const micros =
    movement.unitCostMicros ??
    (movement.unitCostAmount !== undefined ? minorToMicros(movement.unitCostAmount) : undefined);
  if (micros === undefined) return 0;
  const quantity = movement.quantityDelta < 0 ? -movement.quantityDelta : movement.quantityDelta;
  return lineValueMinor(micros, quantity);
}
