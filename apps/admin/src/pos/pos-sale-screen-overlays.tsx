"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PosCatalogRow, PosSaleResponse } from "@banijjik/contracts/pos";
import type { Money } from "@banijjik/contracts/payment";
import type { DisplayLocale } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { CartLine } from "./cart";
import type { TillCustomer } from "./till-customer";
import { PosPaymentSheetLazy } from "./pos-payment-sheet-lazy";
import { PosReceiptLazy } from "./pos-receipt-lazy";
import { PosHeldCartsLazy, type HeldCartMode } from "./pos-held-carts-lazy";
import { PosPriceOverrideLazy } from "./pos-price-override-lazy";
import type { PosLabels } from "./pos-labels";
import type { PosSaleScreenProps } from "./pos-sale-screen";
import type { ReceiptModel } from "./receipt-model";
export function ReceiptOverlay(props: {
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly model: ReceiptModel;
  readonly onNewSale: () => void;
}): ReactElement {
  return (
    <PosReceiptLazy
      labels={props.labels}
      locale={props.locale}
      model={props.model}
      onNewSale={props.onNewSale}
    />
  );
}

export function HeldCartOverlay(props: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly labels: PosLabels;
  readonly mode: HeldCartMode;
  readonly lines: readonly CartLine[];
  readonly contactId: string | null;
  readonly rows: readonly PosCatalogRow[];
  readonly onHeld: () => void;
  readonly onResume: (lines: readonly CartLine[], customer: TillCustomer | null) => void;
  readonly onClose: () => void;
}): ReactElement {
  return <PosHeldCartsLazy {...props} />;
}

export function PriceOverrideOverlay(props: {
  readonly organizationId: string;
  readonly locationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly line: CartLine;
  readonly lines: readonly CartLine[];
  readonly onApply: (lineKey: string, money: Money | null, token: string | null) => void;
  readonly onClose: () => void;
}): ReactElement {
  return <PosPriceOverrideLazy {...props} listPrice={props.line.listPrice} />;
}

export function PaymentOverlay(props: {
  readonly screen: PosSaleScreenProps;
  readonly lines: readonly CartLine[];
  readonly priceOverrideToken: string | null;
  readonly customer: TillCustomer | null;
  readonly onCustomerChange: (customer: TillCustomer | null) => void;
  readonly onPaid: (sale: PosSaleResponse) => void;
  readonly onBack: () => void;
}): ReactElement {
  return (
    <PosPaymentSheetLazy
      organizationId={props.screen.organizationId}
      locationId={props.screen.locationId}
      currency={props.screen.currency}
      locale={props.screen.locale}
      lines={props.lines}
      labels={props.screen.labels}
      canFindCustomer={props.screen.canFindCustomer}
      initialCustomer={props.customer}
      onCustomerChange={props.onCustomerChange}
      priceOverrideToken={props.priceOverrideToken}
      onPaid={props.onPaid}
      onBack={props.onBack}
    />
  );
}
