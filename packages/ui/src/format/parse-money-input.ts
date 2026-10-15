const MONEY_FRACTION_DIGIT_LIMIT = 6;
const SAFE_INTEGER_DIGIT_LENGTH = 15;
const BENGALI_DIGIT_OFFSET = "০".charCodeAt(0);
const SIGNED_MONEY_TEXT = /^(-?)(\d+)(?:\.(\d+))?$/;

export interface ParsedMoney {
  readonly minorUnits: number;
}

/** True when the caller asked for a fraction width this parser can do with integer digits only. */
function isSupportedFractionWidth(fractionDigits: number): boolean {
  return (
    Number.isInteger(fractionDigits) &&
    fractionDigits >= 0 &&
    fractionDigits <= MONEY_FRACTION_DIGIT_LIMIT
  );
}

/** Bangla digits become Latin digits. The decimal point stays ASCII, matching typed "১২.৫০". */
function toLatinDigits(text: string): string {
  return text.replace(/[০-৯]/gu, (digit) => String(digit.charCodeAt(0) - BENGALI_DIGIT_OFFSET));
}

/**
 * Joins major and fraction digits into minor units. `Number("1250")` is exact; a float sum such as
 * `0.1 + 0.2` never runs (ADR-013).
 */
interface MoneyDigitParts {
  readonly integerDigits: string;
  readonly fractionDigitsText: string;
  readonly fractionDigits: number;
  readonly negative: boolean;
}

function minorUnitsFromDigits(parts: MoneyDigitParts): number | undefined {
  if (parts.fractionDigitsText.length > parts.fractionDigits) return undefined;
  const fraction = parts.fractionDigitsText.padEnd(parts.fractionDigits, "0");
  const combined = `${parts.integerDigits}${fraction}`.replace(/^0+(?=\d)/u, "");
  if (combined.length > SAFE_INTEGER_DIGIT_LENGTH) return undefined;
  const absolute = Number(combined);
  if (!Number.isSafeInteger(absolute)) return undefined;
  if (!parts.negative || absolute === 0) return absolute;
  return -absolute;
}

/**
 * Parses major-unit text into integer minor units. An empty string, stray spaces, or too many
 * fraction digits is refused so the field can show the shared validation error instead.
 */
export function parseMoneyInput(text: string, fractionDigits: number): ParsedMoney | undefined {
  if (!isSupportedFractionWidth(fractionDigits)) return undefined;
  const match = SIGNED_MONEY_TEXT.exec(toLatinDigits(text.trim()));
  if (match === null) return undefined;
  const minorUnits = minorUnitsFromDigits({
    integerDigits: match[2] ?? "",
    fractionDigitsText: match[3] ?? "",
    fractionDigits,
    negative: match[1] === "-",
  });
  if (minorUnits === undefined) return undefined;
  return { minorUnits };
}
