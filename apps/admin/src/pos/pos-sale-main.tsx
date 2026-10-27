"use client";

import type { PosCatalogRow, PosSessionResponse } from "@banijjik/contracts/pos";
import { OFFERING_KIND } from "@banijjik/contracts";
import { Button, TextInput, type DisplayLocale } from "@banijjik/ui";
import { useMemo, useState, type ReactElement } from "react";
import type { CartLine } from "./cart";
import { searchCatalog } from "./catalog-search";
import { PosCartPanel } from "./pos-cart-panel";
import type { PosLabels } from "./pos-labels";

const TOUCH_TARGET_CLASS = "min-h-14";

export interface SaleMainProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly locale: DisplayLocale;
  readonly labels: PosLabels;
  readonly isOnline: boolean;
  readonly rows: readonly PosCatalogRow[];
  readonly cartLines: readonly CartLine[];
  readonly cartCount: number;
  readonly onAdd: (row: PosCatalogRow) => void;
  readonly onQuantity: (lineKey: string, quantity: number) => void;
  readonly onPerformer: (lineKey: string, memberId: string | null, name: string | null) => void;
  readonly onRemove: (lineKey: string) => void;
  readonly onClear: () => void;
  readonly onPay: () => void;
  readonly onCloseRegister: () => void;
  readonly canOverridePrice: boolean;
  readonly session: PosSessionResponse;
  readonly onEditPrice: (line: CartLine) => void;
  readonly onHold: () => void;
  readonly onShowHeld: () => void;
  readonly onReturn: () => void;
}

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
          {row.kind === OFFERING_KIND.SERVICE ? (
            <span className="ms-2 text-small text-secondary">{labels.kindService}</span>
          ) : null}
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

function TillActions(props: {
  readonly labels: PosLabels;
  readonly cartCount: number;
  readonly onHold: () => void;
  readonly onShowHeld: () => void;
  readonly onReturn: () => void;
}): ReactElement {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Button
        variant="secondary"
        className={`${TOUCH_TARGET_CLASS} w-full`}
        disabled={props.cartCount === 0}
        onClick={props.onHold}
      >
        {props.labels.till.hold}
      </Button>
      <Button
        variant="secondary"
        className={`${TOUCH_TARGET_CLASS} w-full`}
        onClick={props.onShowHeld}
      >
        {props.labels.till.held}
      </Button>
      <Button
        variant="secondary"
        className={`${TOUCH_TARGET_CLASS} w-full`}
        onClick={props.onReturn}
      >
        {props.labels.till.return}
      </Button>
    </div>
  );
}

function addAndClearSearch(
  row: PosCatalogRow,
  onAdd: (row: PosCatalogRow) => void,
  clear: () => void,
): void {
  onAdd(row);
  clear();
}

/** The sale itself: search, cart and the Pay button. Pay stays off offline and for an empty cart. */
export function SaleMain(props: SaleMainProps): ReactElement {
  const { labels, isOnline, rows, cartLines, cartCount, onAdd, onQuantity, onRemove } = props;
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCatalog(rows, query), [rows, query]);
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
        onAdd={(row) => addAndClearSearch(row, onAdd, () => setQuery(""))}
      />
      <PosCartPanel
        organizationId={props.organizationId}
        locationId={props.locationId}
        locale={props.locale}
        labels={labels}
        canOverridePrice={props.canOverridePrice}
        lines={cartLines}
        onEditPrice={props.onEditPrice}
        onQuantity={onQuantity}
        onPerformer={props.onPerformer}
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
      <TillActions
        labels={labels}
        cartCount={cartCount}
        onHold={props.onHold}
        onShowHeld={props.onShowHeld}
        onReturn={props.onReturn}
      />
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
