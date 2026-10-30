"use client";

import type { Locale, Translator } from "@banijjik/i18n";
import { Button, PublicImage } from "@banijjik/ui";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import { cartStore, type CartLine } from "./cart-store";

function formatPrice(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function LineRowDetails({
  line,
  locale,
}: {
  readonly line: CartLine;
  readonly locale: Locale;
}): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="h-16 w-16 overflow-hidden rounded bg-subtle">
        {line.display.mediaUrl ? (
          <PublicImage
            src={line.display.mediaUrl}
            alt={localizedText(line.display.offeringName, locale)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-secondary">
            {line.display.kind}
          </div>
        )}
      </div>
      <div className="flex flex-col">
        <span className="text-title font-semibold text-primary">
          {localizedText(line.display.offeringName, locale)}
        </span>
        <span className="text-small text-secondary">
          {localizedText(line.display.variantName, locale)}
        </span>
        <span className="text-small font-semibold text-brand">
          {formatPrice(line.display.unitPrice.amount, line.display.unitPrice.currency)}
        </span>
      </div>
    </div>
  );
}

function LineRowActions({
  selectionId,
  isProduct,
  quantity,
  t,
}: {
  readonly selectionId: string;
  readonly isProduct: boolean;
  readonly quantity: number;
  readonly t: Translator["t"];
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 sm:justify-end">
      {isProduct ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-9 w-9 p-0 font-bold"
            onClick={() => cartStore.updateQuantity(selectionId, quantity - 1)}
          >
            -
          </Button>
          <span className="w-8 text-center text-body font-semibold">{quantity}</span>
          <Button
            type="button"
            variant="secondary"
            className="h-9 w-9 p-0 font-bold"
            onClick={() => cartStore.updateQuantity(selectionId, quantity + 1)}
          >
            +
          </Button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className="min-h-11 text-small text-danger"
        onClick={() => cartStore.removeItem(selectionId)}
      >
        {t("storefront.cart.remove")}
      </Button>
    </div>
  );
}

export function CartLineRow({
  line,
  locale,
  t,
}: {
  readonly line: CartLine;
  readonly locale: Locale;
  readonly t: Translator["t"];
}): ReactElement {
  const isProduct = line.selection.kind === "PRODUCT";
  const quantity = isProduct ? line.selection.quantity : 1;

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <LineRowDetails line={line} locale={locale} />
      <LineRowActions
        selectionId={line.selectionId}
        isProduct={isProduct}
        quantity={quantity}
        t={t}
      />
    </div>
  );
}
