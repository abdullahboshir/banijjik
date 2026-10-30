"use client";

import type { PublicQuoteResponse } from "@banijjik/contracts/website";
import type { Translator } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { CartState } from "./cart-store";

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function QuotePriceLines({
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
    <div className="flex flex-col gap-2 border-t border-default pt-3">
      <div className="flex justify-between text-body text-secondary">
        <span>{t("storefront.cart.subtotal")}</span>
        <span>{formatPrice(subtotal, quote.total.currency)}</span>
      </div>
      {discount > 0 ? (
        <div className="flex justify-between text-body text-green-700">
          <span>{t("storefront.cart.discount")}</span>
          <span>-{formatPrice(discount, quote.total.currency)}</span>
        </div>
      ) : null}
      <div className="flex justify-between text-body text-secondary">
        <span>{t("storefront.cart.deliveryCharge")}</span>
        <span>{formatPrice(quote.deliveryCharge.amount, quote.deliveryCharge.currency)}</span>
      </div>
      <div className="flex justify-between text-body text-secondary">
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

export function CartQuoteSidebar({
  cart,
  isQuoting,
  quoteError,
  t,
  onProceed,
}: {
  readonly cart: CartState;
  readonly isQuoting: boolean;
  readonly quoteError: string | null;
  readonly t: Translator["t"];
  readonly onProceed: () => void;
}): ReactElement {
  const quote = cart.quote;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-lg border border-default bg-surface p-4">
        <h2 className="text-title font-semibold text-primary">
          {t("storefront.checkout.summaryTitle")}
        </h2>

        {isQuoting ? (
          <div className="text-small text-secondary">{t("storefront.cart.quoteLoading")}</div>
        ) : null}

        {!isQuoting && quoteError ? (
          <div role="alert" className="text-small text-danger">
            {quoteError}
          </div>
        ) : null}

        {!isQuoting && !quoteError && quote ? <QuotePriceLines quote={quote} t={t} /> : null}

        <Button
          variant="primary"
          className="min-h-11 w-full text-base font-semibold"
          disabled={isQuoting || !quote}
          onClick={onProceed}
        >
          {t("storefront.cart.proceedToCheckout")} &rarr;
        </Button>
      </div>
    </div>
  );
}
