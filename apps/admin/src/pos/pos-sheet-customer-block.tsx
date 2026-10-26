"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import { formatMoney, type DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { PosLabels } from "./pos-labels";
import { PosCustomerPicker } from "./pos-customer-picker";
import type { SheetCustomerState } from "./pos-sheet-customer";

/** The store credit field and the credit-sale choice, shown once a customer is attached. */
function CreditControls(props: {
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly sheet: SheetCustomerState;
}): ReactElement | null {
  const { currency, locale, labels, sheet } = props;
  const customerLabels = labels.customerLabels;
  const creditText = formatMoney({ amount: sheet.creditUseMinor, currency }, { locale });
  return (
    <div className="flex flex-col gap-3">
      {sheet.customer && sheet.customer.balanceMinor > 0 ? (
        <label className="flex flex-col gap-1 text-body font-semibold text-primary">
          {customerLabels.creditUse}
          <input
            inputMode="decimal"
            value={sheet.creditText}
            onChange={(event) => sheet.setCreditText(event.target.value.trim())}
            className="min-h-14 rounded-md border border-current px-3 text-h3"
          />
          <span className="text-small font-normal text-secondary">{creditText}</span>
        </label>
      ) : null}
      <label className="flex min-h-14 items-center gap-3 text-body text-primary">
        <input
          type="checkbox"
          className="size-6"
          checked={sheet.creditSale}
          onChange={(event) => sheet.setCreditSale(event.target.checked)}
        />
        <span className="flex flex-col">
          <span className="font-semibold">{customerLabels.creditSale}</span>
          <span className="text-small text-secondary">{customerLabels.creditSaleHint}</span>
        </span>
      </label>
    </div>
  );
}

/** The customer block: find or attach a customer, then their store credit and credit-sale choice. */
export function CustomerBlock(props: {
  readonly canFind: boolean;
  readonly organizationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly sheet: SheetCustomerState;
}): ReactElement | null {
  const { canFind, organizationId, currency, locale, labels, sheet } = props;
  if (!canFind) return null;
  return (
    <section className="flex flex-col gap-3">
      <PosCustomerPicker
        organizationId={organizationId}
        currency={currency}
        locale={locale}
        labels={labels.customerLabels}
        customer={sheet.customer}
        onChange={sheet.chooseCustomer}
      />
      {sheet.customer ? (
        <CreditControls currency={currency} locale={locale} labels={labels} sheet={sheet} />
      ) : null}
    </section>
  );
}
