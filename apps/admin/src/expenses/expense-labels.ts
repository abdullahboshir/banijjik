import type { ExpensePaidVia, ExpenseStatus } from "@banijjik/contracts/accounting";
import type { Locale } from "@banijjik/i18n";
import type { Translator } from "@banijjik/i18n";

export function localizedNameOf(
  name: { readonly bn: string; readonly en: string },
  locale: Locale,
): string {
  const text = name[locale].trim();
  if (text.length > 0) return text;
  return (locale === "bn" ? name.en : name.bn).trim();
}

export function paidViaLabelOf(paidVia: ExpensePaidVia, t: Translator["t"]): string {
  return t(`expenses.paidVia.${paidVia}`);
}

export function statusLabelOf(status: ExpenseStatus, t: Translator["t"]): string {
  return t(`expenses.status.${status}`);
}
