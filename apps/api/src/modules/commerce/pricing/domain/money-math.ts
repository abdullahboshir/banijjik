/**
 * Integer / BigInt money helpers for the quote pipeline (ADR-013, ADR-120).
 * Never use floating-point arithmetic on money or quantities.
 */

/** Round half up: remainder ≥ half of the divisor adds one. */
export function divideRoundHalfUp(numerator: bigint, divisor: bigint): bigint {
  if (divisor <= 0n) throw new Error("pricing.divisor_must_be_positive");
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const quotient = absolute / divisor;
  const remainder = absolute % divisor;
  const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** `unitPrice × quantity / 10^precision`, half up to minor units. */
export function lineGrossOf(input: {
  readonly unitPriceMinor: number;
  readonly quantity: number;
  readonly precision: number;
}): number {
  const scale = 10n ** BigInt(input.precision);
  const gross = divideRoundHalfUp(BigInt(input.unitPriceMinor) * BigInt(input.quantity), scale);
  return toSafeNumber(gross);
}

/** `amount × quantity / 10^precision`, half up. */
export function scaleByQuantity(input: {
  readonly amountMinor: number;
  readonly quantity: number;
  readonly precision: number;
}): number {
  return lineGrossOf({
    unitPriceMinor: input.amountMinor,
    quantity: input.quantity,
    precision: input.precision,
  });
}

/** Percent of an amount in basis points, half up. */
export function percentOf(amountMinor: number, basisPoints: number): number {
  return toSafeNumber(divideRoundHalfUp(BigInt(amountMinor) * BigInt(basisPoints), 10_000n));
}

/**
 * Inclusive tax split: `round(net × rate / (10000 + rate))` in minor units.
 * Exclusive tax: `round(net × rate / 10000)`.
 */
export function taxOf(input: {
  readonly netMinor: number;
  readonly rateBasisPoints: number;
  readonly taxInclusive: boolean;
}): number {
  if (input.rateBasisPoints === 0 || input.netMinor <= 0) return 0;
  const rate = BigInt(input.rateBasisPoints);
  const net = BigInt(input.netMinor);
  if (input.taxInclusive) {
    return toSafeNumber(divideRoundHalfUp(net * rate, 10_000n + rate));
  }
  return toSafeNumber(divideRoundHalfUp(net * rate, 10_000n));
}

/** Largest-remainder allocation of `total` across non-negative weights. */
export function allocateByLargestRemainder(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (total === 0 || weightTotal <= 0) return weights.map(() => 0);

  const exact = weights.map((weight) => (BigInt(total) * BigInt(weight)) / BigInt(weightTotal));
  const floors = exact.map((value) => Number(value));
  let remaining = total - floors.reduce((sum, value) => sum + value, 0);
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: (BigInt(total) * BigInt(weight)) % BigInt(weightTotal),
  }));
  remainders.sort((left, right) => {
    if (right.remainder === left.remainder) return left.index - right.index;
    return right.remainder > left.remainder ? 1 : -1;
  });
  const result = [...floors];
  for (const entry of remainders) {
    if (remaining <= 0) break;
    result[entry.index] = (result[entry.index] ?? 0) + 1;
    remaining -= 1;
  }
  return result;
}

/** Cash rounding to the nearest N taka (100 minor units = 1 taka). */
export function cashRound(
  grandTotalMinor: number,
  rounding: "NONE" | "NEAREST_1" | "NEAREST_5" | "NEAREST_10",
): {
  readonly roundedTotal: number;
  readonly roundingAdjustment: number;
} {
  if (rounding === "NONE") {
    return { roundedTotal: grandTotalMinor, roundingAdjustment: 0 };
  }
  let takaStep = 10;
  if (rounding === "NEAREST_1") takaStep = 1;
  else if (rounding === "NEAREST_5") takaStep = 5;
  const stepMinor = BigInt(takaStep * 100);
  const total = BigInt(grandTotalMinor);
  const rounded = divideRoundHalfUp(total, stepMinor) * stepMinor;
  const roundedTotal = toSafeNumber(rounded);
  return { roundedTotal, roundingAdjustment: roundedTotal - grandTotalMinor };
}

function toSafeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("pricing.amount_overflow");
  }
  return Number(value);
}
