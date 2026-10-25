"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PosCatalogRow, PosSaleResponse } from "@banijjik/contracts/pos";
import { Button, TextInput, type DisplayLocale } from "@banijjik/ui";
import { useMemo, useReducer, useState, type ReactElement } from "react";
import { cartItemCount, cartReducer, EMPTY_CART, type CartLine } from "./cart";
import { searchCatalog } from "./catalog-search";
import { PosCartPanel } from "./pos-cart-panel";
import { PosPaymentSheetLazy } from "./pos-payment-sheet-lazy";
import { PosReceiptLazy } from "./pos-receipt-lazy";
import type { PosLabels } from "./pos-labels";
import { buildReceiptModel, type ReceiptModel } from "./receipt-model";
import { useOnlineStatus } from "./use-online-status";

export interface PosSaleScreenProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly rows: readonly PosCatalogRow[];
  readonly onCloseRegister: () => void;
}

const TOUCH_TARGET_CLASS = "min-h-14";

function ResultRow(props: {
  readonly row: PosCatalogRow;
  readonly labels: PosLabels;
  readonly onAdd: (row: PosCatalogRow) => void;
}): ReactElement {
  const { row, labels, onAdd } = props;
  return (
    <li>
      <Button
        variant="secondary"
        className={`${TOUCH_TARGET_CLASS} w-full justify-between`}
        aria-label={`${labels.add} ${row.offeringName} ${row.variantName}`}
        onClick={() => onAdd(row)}
      >
        <span className="truncate text-start">
          {row.offeringName}
          <span className="text-secondary"> · {row.variantName}</span>
        </span>
        <span aria-hidden="true">+</span>
      </Button>
    </li>
  );
}

function SaleSearch(props: {
  readonly labels: PosLabels;
  readonly query: string;
  readonly onQueryChange: (query: string) => void;
  readonly results: readonly PosCatalogRow[];
  readonly onAdd: (row: PosCatalogRow) => void;
}): ReactElement {
  const { labels, query, onQueryChange, results, onAdd } = props;
  return (
    <>
      <TextInput
        type="search"
        autoFocus
        placeholder={labels.searchPlaceholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className="min-h-14 text-h3"
      />
      {query.trim() && results.length === 0 ? (
        <p className="text-body text-secondary">{labels.noResults}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {results.map((row) => (
          <ResultRow key={row.variantId} row={row} labels={labels} onAdd={onAdd} />
        ))}
      </ul>
    </>
  );
}

/** The line the cart keeps for a scanned or tapped row; the price stays with the server's quote. */
function cartLineOf(
  row: PosCatalogRow,
): Pick<PosCatalogRow, "offeringId" | "variantId" | "offeringName" | "variantName"> {
  return {
    offeringId: row.offeringId,
    variantId: row.variantId,
    offeringName: row.offeringName,
    variantName: row.variantName,
  };
}

/** Scan or type to find a product, tap to add it, then Pay; the receipt shows after a completed sale. */
export function PosSaleScreen(props: PosSaleScreenProps): ReactElement {
  const { organizationId, locationId, currency, locale, labels, rows, onCloseRegister } = props;
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptModel | null>(null);
  const isOnline = useOnlineStatus();

  function handlePaid(sale: PosSaleResponse): void {
    setPaying(false);
    setReceipt(buildReceiptModel(sale));
    dispatch({ type: "clear" });
  }

  if (receipt) {
    return (
      <PosReceiptLazy
        labels={labels}
        locale={locale}
        model={receipt}
        onNewSale={() => setReceipt(null)}
      />
    );
  }
  if (paying) {
    return (
      <PosPaymentSheetLazy
        organizationId={organizationId}
        locationId={locationId}
        currency={currency}
        locale={locale}
        lines={cart.lines}
        labels={labels}
        onPaid={handlePaid}
        onBack={() => setPaying(false)}
      />
    );
  }

  return (
    <SaleMain
      labels={labels}
      isOnline={isOnline}
      rows={rows}
      cartLines={cart.lines}
      cartCount={cartItemCount(cart)}
      onAdd={(row) => dispatch({ type: "add", line: cartLineOf(row) })}
      onQuantity={(lineKey, quantity) => dispatch({ type: "setQuantity", lineKey, quantity })}
      onRemove={(lineKey) => dispatch({ type: "remove", lineKey })}
      onClear={() => dispatch({ type: "clear" })}
      onPay={() => setPaying(true)}
      onCloseRegister={onCloseRegister}
    />
  );
}

interface SaleMainProps {
  readonly labels: PosLabels;
  readonly isOnline: boolean;
  readonly rows: readonly PosCatalogRow[];
  readonly cartLines: readonly CartLine[];
  readonly cartCount: number;
  readonly onAdd: (row: PosCatalogRow) => void;
  readonly onQuantity: (lineKey: string, quantity: number) => void;
  readonly onRemove: (lineKey: string) => void;
  readonly onClear: () => void;
  readonly onPay: () => void;
  readonly onCloseRegister: () => void;
}

/** The sale itself: search, cart and the Pay button. Pay is off offline and for an empty cart. */
function SaleMain(props: SaleMainProps): ReactElement {
  const { labels, isOnline, rows, cartLines, cartCount, onAdd, onQuantity, onRemove } = props;
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCatalog(rows, query), [rows, query]);

  function handleAdd(row: PosCatalogRow): void {
    onAdd(row);
    setQuery("");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      {isOnline ? null : (
        <p role="status" className="rounded-md bg-warning/10 p-3 text-body text-warning">
          {labels.offline}
        </p>
      )}
      <SaleSearch
        labels={labels}
        query={query}
        onQueryChange={setQuery}
        results={results}
        onAdd={handleAdd}
      />
      <PosCartPanel
        labels={labels}
        lines={cartLines}
        onQuantity={onQuantity}
        onRemove={onRemove}
        onClear={props.onClear}
      />
      <Button
        className={`${TOUCH_TARGET_CLASS} w-full`}
        disabled={!isOnline || cartCount === 0}
        onClick={props.onPay}
      >
        {labels.pay}
      </Button>
      {cartCount > 0 ? <p className="text-small text-secondary">{labels.closeBlocked}</p> : null}
      <Button
        variant="secondary"
        className={`${TOUCH_TARGET_CLASS} w-full`}
        disabled={cartCount > 0}
        onClick={props.onCloseRegister}
      >
        {labels.closeRegister}
      </Button>
    </div>
  );
}
