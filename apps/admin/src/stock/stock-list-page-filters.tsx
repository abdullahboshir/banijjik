import type { ReactElement } from "react";
import type { CatalogLookups } from "../catalog/catalog-lookups";
import { LowStockChip, StockSearchForm } from "./stock-list-controls";
import { StockLocationFilter } from "./stock-location-filter";
import type { StockLabels } from "./stock-labels";
import type { StockQuery } from "./stock-query";

export function StockListPageFilters(props: {
  basePath: string;
  query: StockQuery;
  lookups: CatalogLookups;
  labels: StockLabels;
}): ReactElement {
  return (
    <>
      {props.lookups.locations.length > 0 ? (
        <StockLocationFilter
          basePath={props.basePath}
          query={props.query}
          locations={props.lookups.locations}
          label={props.labels.locationLabel}
        />
      ) : null}
      <LowStockChip basePath={props.basePath} query={props.query} label={props.labels.lowOnly} />
      <StockSearchForm
        query={props.query}
        searchLabel={props.labels.searchLabel}
        searchSubmit={props.labels.searchSubmit}
      />
    </>
  );
}
