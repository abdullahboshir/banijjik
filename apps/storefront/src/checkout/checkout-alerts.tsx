"use client";

import type { Translator } from "@banijjik/i18n";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";

export function CheckoutAlerts({
  quoteExpiredAlert,
  priceChangedAlert,
  isSubmitting,
  t,
  onRefresh,
}: {
  readonly quoteExpiredAlert: boolean;
  readonly priceChangedAlert: boolean;
  readonly isSubmitting: boolean;
  readonly t: Translator["t"];
  readonly onRefresh: () => void;
}): ReactElement | null {
  if (quoteExpiredAlert) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900"
      >
        <div>
          <h3 className="font-semibold">{t("storefront.checkout.quoteExpiredTitle")}</h3>
          <p className="text-small">{t("storefront.checkout.quoteExpiredMessage")}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          className="min-h-11 w-fit"
          onClick={onRefresh}
          isLoading={isSubmitting}
        >
          {t("storefront.checkout.refreshQuote")}
        </Button>
      </div>
    );
  }
  if (priceChangedAlert) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 text-blue-900"
      >
        <div>
          <h3 className="font-semibold">{t("storefront.checkout.priceChangedTitle")}</h3>
          <p className="text-small">{t("storefront.checkout.priceChangedMessage")}</p>
        </div>
        <Button
          type="button"
          variant="primary"
          className="min-h-11 w-fit"
          onClick={onRefresh}
          isLoading={isSubmitting}
        >
          {t("storefront.checkout.acceptPriceChange")}
        </Button>
      </div>
    );
  }
  return null;
}
