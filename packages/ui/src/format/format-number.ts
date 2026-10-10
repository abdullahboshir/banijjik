export type DisplayLocale = "bn" | "en";
export type DigitScript = "LATIN" | "BENGALI";
export type NumberGrouping = "WESTERN" | "SOUTH_ASIAN";

/**
 * `locale` is part of the contract (13-UX section 7) but both locales render Latin digits by
 * default, so only `digitScript` and `grouping` change the output today.
 */
export interface NumberFormatOptions {
  locale: DisplayLocale;
  digitScript?: DigitScript;
  grouping?: NumberGrouping;
}

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"] as const;
const WESTERN_GROUP_SIZE = 3;
const SOUTH_ASIAN_GROUP_SIZE = 2;

export function groupDigits(digits: string, grouping: NumberGrouping): string {
  if (digits.length <= WESTERN_GROUP_SIZE) return digits;
  const lastGroup = digits.slice(-WESTERN_GROUP_SIZE);
  const rest = digits.slice(0, -WESTERN_GROUP_SIZE);
  const groupSize = grouping === "SOUTH_ASIAN" ? SOUTH_ASIAN_GROUP_SIZE : WESTERN_GROUP_SIZE;
  const groups: string[] = [];
  for (let end = rest.length; end > 0; end -= groupSize) {
    groups.unshift(rest.slice(Math.max(0, end - groupSize), end));
  }
  return [...groups, lastGroup].join(",");
}

export function convertDigitScript(text: string, digitScript: DigitScript): string {
  if (digitScript === "LATIN") return text;
  return text.replace(/\d/g, (digit) => BENGALI_DIGITS[Number(digit)] ?? digit);
}

/** Formats an already-split number. Integer digits are never passed through floating point. */
export function formatDigitParts(
  parts: { integerDigits: string; fractionDigits: string },
  options: NumberFormatOptions,
): string {
  const grouped = groupDigits(parts.integerDigits, options.grouping ?? "WESTERN");
  const text = parts.fractionDigits ? `${grouped}.${parts.fractionDigits}` : grouped;
  return convertDigitScript(text, options.digitScript ?? "LATIN");
}

/** Formats a quantity or count (callers pass counts and quantities, never values beyond 2^53). Money must use formatMoney, which works on integer minor units. */
export function formatNumber(value: number, options: NumberFormatOptions): string {
  // Beyond the safe-integer range (or with a fraction in exponent form) toString gives "1e+21".
  if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) {
    throw new RangeError("formatNumber needs a finite number within the safe integer range");
  }
  const [integerDigits = "0", fractionDigits = ""] = Math.abs(value).toString().split(".");
  const formatted = formatDigitParts({ integerDigits, fractionDigits }, options);
  return value < 0 ? `-${formatted}` : formatted;
}
