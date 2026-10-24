"use client";

import type { OfferingListItem, OfferingResponse } from "@banijjik/contracts/catalog";
import { Button, FormField, TextInput, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useEffect, useState, type ReactElement } from "react";
import { getOffering, searchProducts } from "./order-api";
import type { OrderLineLabels } from "./order-labels";

const SEARCH_DELAY_MS = 250;

export interface ProductPickerProps {
  readonly organizationId: string;
  readonly id: string;
  readonly selected: OfferingResponse | undefined;
  readonly labels: OrderLineLabels;
  readonly locale: DisplayLocale;
  readonly disabled?: boolean | undefined;
  readonly onChange: (offering: OfferingResponse | undefined) => void;
}

interface SearchState {
  readonly results: readonly OfferingListItem[];
  readonly isSearching: boolean;
  readonly hasFailed: boolean;
}

function useProductSearch(
  organizationId: string,
  query: string,
  hasSelection: boolean,
): SearchState {
  const [state, setState] = useState<SearchState>({
    results: [],
    isSearching: false,
    hasFailed: false,
  });
  useEffect(() => {
    const text = query.trim();
    if (text === "" || hasSelection) {
      setState({ results: [], isSearching: false, hasFailed: false });
      return undefined;
    }
    let isCurrent = true;
    const timer = window.setTimeout(() => {
      async function run(): Promise<void> {
        setState({ results: [], isSearching: true, hasFailed: false });
        try {
          const results = await searchProducts(organizationId, text);
          if (isCurrent) setState({ results, isSearching: false, hasFailed: false });
        } catch {
          if (isCurrent) setState({ results: [], isSearching: false, hasFailed: true });
        }
      }
      void run();
    }, SEARCH_DELAY_MS);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [organizationId, query, hasSelection]);
  return state;
}

function ResultList(props: {
  readonly results: readonly OfferingListItem[];
  readonly locale: DisplayLocale;
  readonly onPick: (item: OfferingListItem) => void;
}): ReactElement {
  return (
    <ul className="flex flex-col gap-1 rounded-md border border-default p-2">
      {props.results.map((item) => (
        <li key={item.offeringId}>
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => props.onPick(item)}
          >
            <span className="min-w-0 break-words">{item.name}</span>
            {item.priceFrom ? (
              <span className="shrink-0 font-money text-small text-secondary">
                {formatMoney(item.priceFrom, { locale: props.locale })}
              </span>
            ) : null}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function useOfferingLoad(
  organizationId: string,
  onLoaded: (offering: OfferingResponse) => void,
): {
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  readonly pick: (item: OfferingListItem) => Promise<void>;
} {
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  async function pick(item: OfferingListItem): Promise<void> {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      onLoaded(await getOffering(organizationId, item.offeringId));
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }
  return { isLoading, loadFailed, pick };
}

function PickerStatus(props: {
  readonly labels: OrderLineLabels;
  readonly isBusy: boolean;
  readonly searchFailed: boolean;
  readonly loadFailed: boolean;
}): ReactElement {
  return (
    <>
      {props.isBusy ? <p className="text-small text-secondary">{props.labels.searching}</p> : null}
      {props.searchFailed ? (
        <p className="text-small text-danger" role="alert">
          {props.labels.searchFailed}
        </p>
      ) : null}
      {props.loadFailed ? (
        <p className="text-small text-danger" role="alert">
          {props.labels.loadFailed}
        </p>
      ) : null}
    </>
  );
}

function PickerOutcome(
  props: ProductPickerProps & {
    readonly search: SearchState;
    readonly hasText: boolean;
    readonly onClear: () => void;
    readonly onPick: (item: OfferingListItem) => void;
  },
): ReactElement | null {
  const { labels, search } = props;
  if (props.selected !== undefined) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={props.disabled === true} onClick={props.onClear}>
          {labels.change}
        </Button>
      </div>
    );
  }
  if (search.results.length > 0) {
    return <ResultList results={search.results} locale={props.locale} onPick={props.onPick} />;
  }
  const showEmpty = props.hasText && !search.isSearching && !search.hasFailed;
  return showEmpty ? <p className="text-small text-secondary">{labels.noResults}</p> : null;
}

/** Searches active products by name, SKU or barcode (a scanner typing here works) and loads the pick. */
export function ProductPicker(props: ProductPickerProps): ReactElement {
  const { labels } = props;
  const [query, setQuery] = useState(props.selected?.name ?? "");
  const { isLoading, loadFailed, pick } = useOfferingLoad(props.organizationId, (offering) => {
    setQuery(offering.name);
    props.onChange(offering);
  });
  const search = useProductSearch(props.organizationId, query, props.selected !== undefined);

  useEffect(() => {
    if (props.selected !== undefined) setQuery(props.selected.name);
  }, [props.selected]);

  function clear(): void {
    setQuery("");
    props.onChange(undefined);
  }

  return (
    <div className="flex flex-col gap-2">
      <FormField label={labels.product} htmlFor={props.id}>
        <TextInput
          id={props.id}
          type="search"
          autoComplete="off"
          placeholder={labels.searchPlaceholder}
          value={query}
          disabled={props.disabled === true || isLoading}
          onChange={(event) => {
            if (props.selected !== undefined) props.onChange(undefined);
            setQuery(event.target.value);
          }}
        />
      </FormField>
      <PickerStatus
        labels={labels}
        isBusy={search.isSearching || isLoading}
        searchFailed={search.hasFailed}
        loadFailed={loadFailed}
      />
      <PickerOutcome
        {...props}
        search={search}
        hasText={query.trim() !== ""}
        onClear={clear}
        onPick={(item) => void pick(item)}
      />
    </div>
  );
}
