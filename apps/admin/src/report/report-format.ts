import { formatMoney, formatNumber, type Money } from "@banijjik/ui";
import type { HomeRowKind } from "./report-home-cards";

type DisplayLocale = Parameters<typeof formatNumber>[1]["locale"];

/** A money figure in minor units, through the shared formatter (never float math on money, ADR-013). */
export function moneyText(amount: number, currency: string, locale: DisplayLocale): string {
  const money: Money = { amount, currency };
  return formatMoney(money, { locale });
}

/** A figure of the given kind: money through the currency formatter, a count as a plain number. */
/** How a figure is shown: its currency for money, and the locale of the screen. */
export interface FigureFormat {
  readonly currency: string;
  readonly locale: DisplayLocale;
}

export function figureText(kind: HomeRowKind, value: number, format: FigureFormat): string {
  if (kind === "money") return moneyText(value, format.currency, format.locale);
  return formatNumber(value, { locale: format.locale });
}
