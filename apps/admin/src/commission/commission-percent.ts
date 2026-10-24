import { COMMISSION_MAX_BASIS_POINTS } from "@banijjik/contracts/commission";

const PERCENT_TEXT = /^(\d{1,3})(?:\.(\d{1,2}))?$/u;
const BENGALI_DIGIT_OFFSET = "০".charCodeAt(0);
const BASIS_POINTS_PER_PERCENT = 100;

function toLatinDigits(text: string): string {
  return text.replace(/[০-৯]/gu, (digit) => String(digit.charCodeAt(0) - BENGALI_DIGIT_OFFSET));
}

/**
 * Percent text ("12.5") to integer basis points (1250). At most two decimals; 100 % is the ceiling.
 * `undefined` means the field can show its shared validation error instead of sending a float.
 */
export function percentTextToBasisPoints(text: string): number | undefined {
  const match = PERCENT_TEXT.exec(toLatinDigits(text.trim()));
  if (match === null) return undefined;
  const whole = Number(match[1] ?? "");
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const basisPoints = whole * BASIS_POINTS_PER_PERCENT + fraction;
  if (!Number.isSafeInteger(basisPoints)) return undefined;
  if (basisPoints < 1 || basisPoints > COMMISSION_MAX_BASIS_POINTS) return undefined;
  return basisPoints;
}

/** Stored basis points as the percent text an edit form shows: 1250 becomes "12.5" and 10000 becomes "100". */
export function percentTextOf(basisPoints: number): string {
  const whole = Math.floor(basisPoints / BASIS_POINTS_PER_PERCENT);
  const fraction = basisPoints % BASIS_POINTS_PER_PERCENT;
  if (fraction === 0) return String(whole);
  return `${whole}.${String(fraction).padStart(2, "0").replace(/0$/u, "")}`;
}
