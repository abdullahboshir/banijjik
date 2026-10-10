import { formatDigitParts, type NumberFormatOptions } from "./format-number.js";

export interface Money {
  /** Integer minor units (paisa for BDT). */
  amount: number;
  currency: string;
}

interface CurrencyFormat {
  symbol: string;
  fractionDigits: number;
}

const THIN_SPACE = " ";
const CURRENCY_FORMATS: Readonly<Record<string, CurrencyFormat>> = {
  BDT: { symbol: "৳", fractionDigits: 2 },
};

function currencyFormatOf(currency: string): CurrencyFormat {
  const format = CURRENCY_FORMATS[currency];
  if (!format) throw new RangeError(`formatMoney does not support currency ${currency}`);
  return format;
}

/** Splits integer minor units into major and minor digits with integer math only (ADR-013). */
function splitMinorUnits(absoluteAmount: number, fractionDigits: number) {
  const unitsPerMajor = 10 ** fractionDigits;
  const major = Math.floor(absoluteAmount / unitsPerMajor);
  const minor = absoluteAmount % unitsPerMajor;
  return { major, minor, minorText: String(minor).padStart(fractionDigits, "0") };
}

/** Shows minor units only when non-zero: "৳ 1,250" and "৳ 1,250.50". */
export function formatMoney(money: Money, options: NumberFormatOptions): string {
  if (!Number.isSafeInteger(money.amount)) {
    throw new RangeError("Money amount must be an integer in minor units");
  }
  const { symbol, fractionDigits } = currencyFormatOf(money.currency);
  const { major, minor, minorText } = splitMinorUnits(Math.abs(money.amount), fractionDigits);
  const formatted = formatDigitParts(
    { integerDigits: String(major), fractionDigits: minor === 0 ? "" : minorText },
    options,
  );
  const sign = money.amount < 0 ? "-" : "";
  return `${sign}${symbol}${THIN_SPACE}${formatted}`;
}
