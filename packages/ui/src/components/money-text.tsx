import type { ReactElement } from "react";
import { formatMoney, type Money } from "../format/format-money.js";
import type { NumberFormatOptions } from "../format/format-number.js";

export interface MoneyTextProps extends NumberFormatOptions {
  money: Money;
}

/** The only component that turns an amount into text (13-UX section 9). */
export function MoneyText({ money, ...options }: MoneyTextProps): ReactElement {
  return <span className="font-money">{formatMoney(money, options)}</span>;
}
