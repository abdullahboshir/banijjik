"use client";

import type { PublicQuoteResponse } from "@banijjik/contracts/website";
import type { Locale, Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import type { CartState } from "./cart-store";

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function SummaryPriceBlock({
  quote,
  t,
}: {
  readonly quote: PublicQuoteResponse;
  readonly t: Translator["t"];
}): ReactElement {
  const subtotal = quote.lines.reduce((acc, l) => acc + l.subtotal.amount, 0);
  const discount = quote.lines.reduce((acc, l) => acc + l.discount.amount, 0);
  const tax = quote.lines.reduce((acc, l) => acc + l.tax.amount, 0);

  return (
    <div className="flex flex-col gap-2 border-t border-default pt-3 text-body">
      <div className="flex justify-between text-secondary">
        <span>{t("storefront.cart.subtotal")}</span>
        <span>{formatPrice(subtotal, quote.total.currency)}</span>
      </div>
      {discount > 0 ? (
        <div className="flex justify-between text-green-700">
          <span>{t("storefront.cart.discount")}</span>
          <span>-{formatPrice(discount, quote.total.currency)}</span>
        </div>
      ) : null}
      <div className="flex justify-between text-secondary">
        <span>{t("storefront.cart.deliveryCharge")}</span>
        <span>{formatPrice(quote.deliveryCharge.amount, quote.deliveryCharge.currency)}</span>
      </div>
      <div className="flex justify-between text-secondary">
        <span>{t("storefront.cart.tax")}</span>
        <span>{formatPrice(tax, quote.total.currency)}</span>
      </div>
      <div className="flex justify-between border-t border-default pt-2 text-title font-bold text-primary">
        <span>{t("storefront.cart.total")}</span>
        <span>{formatPrice(quote.total.amount, quote.total.currency)}</span>
      </div>
    </div>
  );
}

export function CheckoutOrderSummary({
  cart,
  locale,
  t,
}: {
  readonly cart: CartState;
  readonly locale: Locale;
  readonly t: Translator["t"];
}): ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-6">
      <h2 className="text-title font-semibold text-primary">
        {t("storefront.checkout.summaryTitle")}
      </h2>

      <div className="flex flex-col divide-y divide-default">
        {cart.items.map((line) => (
          <div key={line.selectionId} className="flex justify-between py-2 text-small">
            <div className="flex flex-col">
              <span className="font-semibold text-primary">
                {localizedText(line.display.offeringName, locale)}
              </span>
              <span className="text-secondary">
                {localizedText(line.display.variantName, locale)}
                {"quantity" in line.selection ? ` × ${line.selection.quantity}` : ""}
              </span>
            </div>
            <span className="font-semibold text-primary">
              {formatPrice(line.display.unitPrice.amount, line.display.unitPrice.currency)}
            </span>
          </div>
        ))}
      </div>

      {cart.quote ? <SummaryPriceBlock quote={cart.quote} t={t} /> : null}
    </div>
  );
}
