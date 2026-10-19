"use client";

import type { InventoryItemListItem } from "@banijjik/contracts/inventory";
import { Button, FormField, TextInput } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import type { ItemPickerLabels } from "./stock-labels";
import { useInventoryItemSearch } from "./use-inventory-item-search";

export interface InventoryItemPickerProps {
  organizationId: string;
  id: string;
  label: string;
  value: InventoryItemListItem | undefined;
  labels: ItemPickerLabels;
  disabled?: boolean;
  onChange: (item: InventoryItemListItem | undefined) => void;
}

function SearchResults(props: {
  results: InventoryItemListItem[];
  onPick: (item: InventoryItemListItem) => void;
}): ReactElement | null {
  if (props.results.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-md border border-default p-2">
      {props.results.map((item) => (
        <li key={item.inventoryItemId}>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => props.onPick(item)}
          >
            {item.name}
            {item.sku ? ` · ${item.sku}` : ""}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function InventoryItemPicker(props: InventoryItemPickerProps): ReactElement {
  const [query, setQuery] = useState(props.value?.name ?? "");
  const { results, isSearching } = useInventoryItemSearch(props.organizationId, query, props.value);

  useEffect(() => {
    if (props.value !== undefined) {
      setQuery(props.value.name);
    }
  }, [props.value]);

  function pick(item: InventoryItemListItem): void {
    props.onChange(item);
    setQuery(item.name);
  }

  const showEmpty =
    query.trim().length > 0 && !isSearching && results.length === 0 && props.value === undefined;

  return (
    <div className="flex flex-col gap-2">
      <FormField label={props.label} htmlFor={props.id}>
        <TextInput
          id={props.id}
          value={query}
          disabled={props.disabled}
          onChange={(event) => {
            props.onChange(undefined);
            setQuery(event.target.value);
          }}
        />
      </FormField>
      {isSearching ? <p className="text-small text-secondary">{props.labels.searching}</p> : null}
      <SearchResults results={results} onPick={pick} />
      {showEmpty ? <p className="text-small text-secondary">{props.labels.empty}</p> : null}
    </div>
  );
}
