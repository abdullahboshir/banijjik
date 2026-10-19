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
  return Number(divideRoundHalfUp(BigInt(costMicros) * BigInt(quantity), COST_MICROS_PER_MINOR));
}
