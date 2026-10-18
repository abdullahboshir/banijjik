import type { Money } from "@banijjik/contracts/catalog";
import { parseMoneyInput } from "@banijjik/ui";

/** Every supported currency counts in hundredths today (the ui formatter has the same default). */
const MONEY_FRACTION_DIGITS = 2;
const UNITS_PER_MAJOR = 10 ** MONEY_FRACTION_DIGITS;

/**
 * Turns what a person typed ("12.50", "১২.৫০") into Money in minor units without floating point
 * (ADR-013). Empty, negative or unreadable text gives `undefined`, so the field shows its own error.
 */
export function moneyFromInput(text: string, currency: Money["currency"]): Money | undefined {
  const parsed = parseMoneyInput(text, MONEY_FRACTION_DIGITS);
  if (parsed === undefined || parsed.minorUnits < 0) return undefined;
  return { amount: parsed.minorUnits, currency };
}

/** The text a money field shows for stored minor units: "1250" becomes "12.5" and "1200" becomes "12". */
export function moneyToInputText(money: Money): string {
  const major = Math.floor(money.amount / UNITS_PER_MAJOR);
  const minor = money.amount % UNITS_PER_MAJOR;
  if (minor === 0) return String(major);
  return `${major}.${String(minor).padStart(MONEY_FRACTION_DIGITS, "0").replace(/0+$/u, "")}`;
}
