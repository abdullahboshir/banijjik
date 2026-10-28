"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PosCatalogRow, PosSaleResponse, PosSessionResponse } from "@banijjik/contracts/pos";
import type { DisplayLocale } from "@banijjik/ui";
import { useReducer, useState, type Dispatch, type ReactElement } from "react";
import {
  cartItemCount,
  cartReducer,
  EMPTY_CART,
  performerNamesOf,
  type CartAction,
  type CartLine,
  type CartState,
} from "./cart";
import type { HeldCartMode } from "./pos-held-carts-lazy";
import { PosReturnLazy } from "./pos-return-lazy";
import type { PosLabels } from "./pos-labels";
import { SaleMain, type SaleMainProps } from "./pos-sale-main";
import {
  HeldCartOverlay,
  PaymentOverlay,
  PriceOverrideOverlay,
  ReceiptOverlay,
} from "./pos-sale-screen-overlays";
import { buildReceiptModel, type ReceiptModel } from "./receipt-model";
import { useOnlineStatus } from "./use-online-status";
import type { TillCustomer } from "./till-customer";

export interface PosSaleScreenProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly rows: readonly PosCatalogRow[];
  readonly onCloseRegister: () => void;
  readonly canFindCustomer: boolean;
  readonly canOverridePrice: boolean;
  readonly session: PosSessionResponse;
}

/** The line the cart keeps for a scanned or tapped row; the price stays with the server's quote. */
function cartLineOf(row: PosCatalogRow): Omit<CartLine, "lineKey" | "quantity"> {
  return {
    offeringId: row.offeringId,
    variantId: row.variantId,
    kind: row.kind,
    offeringName: row.offeringName,
    variantName: row.variantName,
    listPrice: row.price,
    unitPriceOverride: null,
    performedByMemberId: null,
    performerName: null,
  };
}

function receiptOfPaidSale(sale: PosSaleResponse, lines: readonly CartLine[]): ReceiptModel {
  return buildReceiptModel(sale, performerNamesOf(lines));
}

function finishPaidSale(input: {
  readonly sale: PosSaleResponse;
  readonly lines: readonly CartLine[];
  readonly dispatch: Dispatch<CartAction>;
  readonly setPaying: (paying: boolean) => void;
  readonly setCustomer: (customer: TillCustomer | null) => void;
  readonly setReceipt: (model: ReceiptModel) => void;
}): void {
  input.setPaying(false);
  input.setCustomer(null);
  input.setReceipt(receiptOfPaidSale(input.sale, input.lines));
  input.dispatch({ type: "clear" });
}

function cartHandlers(
  updateCart: (action: CartAction) => void,
): Pick<SaleMainProps, "onAdd" | "onQuantity" | "onPerformer" | "onRemove" | "onClear"> {
  return {
    onAdd: (row) => updateCart({ type: "add", line: cartLineOf(row) }),
    onQuantity: (lineKey, quantity) => updateCart({ type: "setQuantity", lineKey, quantity }),
    onPerformer: (lineKey, performedByMemberId, performerName) =>
      updateCart({ type: "setPerformer", lineKey, performedByMemberId, performerName }),
    onRemove: (lineKey) => updateCart({ type: "remove", lineKey }),
    onClear: () => updateCart({ type: "clear" }),
  };
}

function saleMainPropsOf(input: {
  readonly screen: PosSaleScreenProps;
  readonly cartLines: readonly CartLine[];
  readonly cartCount: number;
  readonly isOnline: boolean;
  readonly updateCart: (action: CartAction) => void;
  readonly onEditPrice: (line: CartLine) => void;
  readonly onHold: () => void;
  readonly onShowHeld: () => void;
  readonly onReturn: () => void;
  readonly onPay: () => void;
}): SaleMainProps {
  return {
    organizationId: input.screen.organizationId,
    locationId: input.screen.locationId,
    locale: input.screen.locale,
    labels: input.screen.labels,
    isOnline: input.isOnline,
    rows: input.screen.rows,
    cartLines: input.cartLines,
    cartCount: input.cartCount,
    ...cartHandlers(input.updateCart),
    canOverridePrice: input.screen.canOverridePrice,
    session: input.screen.session,
    onEditPrice: input.onEditPrice,
    onHold: input.onHold,
    onShowHeld: input.onShowHeld,
    onReturn: input.onReturn,
    onPay: input.onPay,
    onCloseRegister: input.screen.onCloseRegister,
  };
}

interface SaleScreenContentProps {
  readonly screen: PosSaleScreenProps;
  readonly cart: CartState;
  readonly dispatch: Dispatch<CartAction>;
  readonly paying: boolean;
  readonly setPaying: (paying: boolean) => void;
  readonly receipt: ReceiptModel | null;
  readonly setReceipt: (receipt: ReceiptModel | null) => void;
  readonly heldMode: HeldCartMode | null;
  readonly setHeldMode: (mode: HeldCartMode | null) => void;
  readonly editingLine: CartLine | null;
  readonly setEditingLine: (line: CartLine | null) => void;
  readonly returnOpen: boolean;
  readonly setReturnOpen: (open: boolean) => void;
  readonly priceOverrideToken: string | null;
  readonly setPriceOverrideToken: (token: string | null) => void;
  readonly isOnline: boolean;
  readonly updateCart: (action: CartAction) => void;
  readonly customer: TillCustomer | null;
  readonly setCustomer: (customer: TillCustomer | null) => void;
}

function secondaryOverlayOf(props: SaleScreenContentProps): ReactElement | null {
  const { screen, cart, dispatch, paying, returnOpen, priceOverrideToken } = props;
  if (returnOpen) {
    return (
      <PosReturnLazy
        organizationId={screen.organizationId}
        locationId={screen.locationId}
        posSessionId={screen.session.posSessionId}
        locale={screen.locale}
        labels={screen.labels}
        onClose={() => props.setReturnOpen(false)}
      />
    );
  }
  if (!paying) return null;
  return (
    <PaymentOverlay
      screen={screen}
      lines={cart.lines}
      priceOverrideToken={priceOverrideToken}
      customer={props.customer}
      onCustomerChange={props.setCustomer}
      onPaid={(sale) =>
        finishPaidSale({
          sale,
          lines: cart.lines,
          dispatch,
          setPaying: props.setPaying,
          setCustomer: props.setCustomer,
          setReceipt: props.setReceipt,
        })
      }
      onBack={() => props.setPaying(false)}
    />
  );
}

function heldCartOverlayOf(props: SaleScreenContentProps, mode: HeldCartMode): ReactElement {
  return (
    <HeldCartOverlay
      organizationId={props.screen.organizationId}
      locationId={props.screen.locationId}
      labels={props.screen.labels}
      mode={mode}
      lines={props.cart.lines}
      contactId={props.customer?.contactId ?? null}
      rows={props.screen.rows}
      onHeld={() => {
        props.updateCart({ type: "clear" });
        props.setCustomer(null);
        props.setHeldMode(null);
      }}
      onResume={(lines, customer) => {
        props.dispatch({ type: "replaceLines", lines });
        props.setCustomer(customer);
        props.setPriceOverrideToken(null);
        props.setHeldMode(null);
      }}
      onClose={() => props.setHeldMode(null)}
    />
  );
}

function priceOverrideOverlayOf(props: SaleScreenContentProps, line: CartLine): ReactElement {
  return (
    <PriceOverrideOverlay
      organizationId={props.screen.organizationId}
      locationId={props.screen.locationId}
      currency={props.screen.currency}
      locale={props.screen.locale}
      labels={props.screen.labels}
      line={line}
      lines={props.cart.lines}
      onApply={(lineKey, money, token) => {
        props.dispatch({ type: "setPriceOverride", lineKey, money });
        const hasDiscountedLine = props.cart.lines.some((cartLine) => {
          const nextPrice = cartLine.lineKey === lineKey ? money : cartLine.unitPriceOverride;
          return nextPrice !== null && nextPrice.amount < cartLine.listPrice.amount;
        });
        props.setPriceOverrideToken(hasDiscountedLine ? (token ?? props.priceOverrideToken) : null);
        props.setEditingLine(null);
      }}
      onClose={() => props.setEditingLine(null)}
    />
  );
}

function SaleScreenContent(props: SaleScreenContentProps): ReactElement {
  const { screen, cart, receipt, heldMode, editingLine, isOnline } = props;
  const { locale, labels } = screen;
  if (receipt !== null)
    return (
      <ReceiptOverlay
        labels={labels}
        locale={locale}
        model={receipt}
        onNewSale={() => props.setReceipt(null)}
      />
    );
  if (heldMode !== null) {
    return heldCartOverlayOf(props, heldMode);
  }
  if (editingLine !== null) return priceOverrideOverlayOf(props, editingLine);
  const overlay = secondaryOverlayOf(props);
  if (overlay !== null) return overlay;
  return (
    <SaleMain
      {...saleMainPropsOf({
        screen,
        cartLines: cart.lines,
        cartCount: cartItemCount(cart),
        isOnline,
        updateCart: props.updateCart,
        onEditPrice: props.setEditingLine,
        onHold: () => props.setHeldMode("hold"),
        onShowHeld: () => props.setHeldMode("list"),
        onReturn: () => props.setReturnOpen(true),
        onPay: () => props.setPaying(true),
      })}
    />
  );
}

/** Scan or type to find a product, tap to add it, then Pay; the receipt shows after a completed sale. */
export function PosSaleScreen(props: PosSaleScreenProps): ReactElement {
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null);
  const [heldMode, setHeldMode] = useState<HeldCartMode | null>(null);
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [priceOverrideToken, setPriceOverrideToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<TillCustomer | null>(null);
  const isOnline = useOnlineStatus();
  function updateCart(action: CartAction): void {
    dispatch(action);
    setPriceOverrideToken(null);
  }
  return (
    <SaleScreenContent
      screen={props}
      cart={cart}
      dispatch={dispatch}
      paying={paying}
      setPaying={setPaying}
      receipt={receipt}
      setReceipt={setReceipt}
      heldMode={heldMode}
      setHeldMode={setHeldMode}
      editingLine={editingLine}
      setEditingLine={setEditingLine}
      returnOpen={returnOpen}
      setReturnOpen={setReturnOpen}
      priceOverrideToken={priceOverrideToken}
      setPriceOverrideToken={setPriceOverrideToken}
      isOnline={isOnline}
      updateCart={updateCart}
      customer={customer}
      setCustomer={setCustomer}
    />
  );
}
