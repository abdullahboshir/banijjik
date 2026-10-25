"use client";

import type { PosCatalogRow } from "@banijjik/contracts/pos";
import { Button, TextInput } from "@banijjik/ui";
import { useMemo, useReducer, useState, type ReactElement } from "react";
import { cartItemCount, cartReducer, EMPTY_CART } from "./cart";
import { searchCatalog } from "./catalog-search";
import { PosCartPanel } from "./pos-cart-panel";
import type { PosLabels } from "./pos-labels";
import { useOnlineStatus } from "./use-online-status";

export interface PosSaleScreenProps {
  readonly labels: PosLabels;
  readonly rows: readonly PosCatalogRow[];
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

/** Scan or type to find a product, tap to add it, then take payment (the payment step is wired in part 2). */
export function PosSaleScreen(props: PosSaleScreenProps): ReactElement {
  const { labels, rows } = props;
  const [query, setQuery] = useState("");
  const [cart, dispatch] = useReducer(cartReducer, EMPTY_CART);
  const isOnline = useOnlineStatus();
  const results = useMemo(() => searchCatalog(rows, query), [rows, query]);

  function handleAdd(row: PosCatalogRow): void {
    dispatch({
      type: "add",
      line: {
        offeringId: row.offeringId,
        variantId: row.variantId,
        offeringName: row.offeringName,
        variantName: row.variantName,
      },
    });
    setQuery("");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      {isOnline ? null : (
        <p role="status" className="rounded-md bg-warning/10 p-3 text-body text-warning">
          {labels.offline}
        </p>
      )}
      <TextInput
        type="search"
        autoFocus
        placeholder={labels.searchPlaceholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="min-h-14 text-h3"
      />
      {query.trim() && results.length === 0 ? (
        <p className="text-body text-secondary">{labels.noResults}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {results.map((row) => (
          <ResultRow key={row.variantId} row={row} labels={labels} onAdd={handleAdd} />
        ))}
      </ul>
      <PosCartPanel
        labels={labels}
        lines={cart.lines}
        onQuantity={(lineKey, quantity) => dispatch({ type: "setQuantity", lineKey, quantity })}
        onRemove={(lineKey) => dispatch({ type: "remove", lineKey })}
        onClear={() => dispatch({ type: "clear" })}
      />
      <Button
        className={`${TOUCH_TARGET_CLASS} w-full`}
        disabled={!isOnline || cartItemCount(cart) === 0}
      >
        {labels.pay}
      </Button>
    </div>
  );
}
