import type { Translator } from "@banijjik/i18n";
import { EmptyState } from "@banijjik/ui";
import type { ReactElement } from "react";
import { StockPager } from "./stock-list-controls";
import { StockList, type StockListLabels, type StockRowView } from "./stock-list";
import type { StockLabels } from "./stock-labels";
import type { StockQuery } from "./stock-query";

export function StockListPageBody(props: {
  basePath: string;
  query: StockQuery;
  labels: StockLabels;
  listLabels: StockListLabels;
  rows: StockRowView[];
  hasNext: boolean;
  t: Translator["t"];
}): ReactElement {
  return (
    <>
      <StockList
        rows={props.rows}
        detailBasePath={props.basePath}
        labels={props.listLabels}
        empty={
          props.query.q || props.query.lowOnly ? (
            <EmptyState kind="noResults" message={props.labels.noMatch} />
          ) : (
            <EmptyState kind="none" message={props.labels.empty} />
          )
        }
      />
      <StockPager
        basePath={props.basePath}
        query={props.query}
        hasNext={props.hasNext}
        t={props.t}
        labels={{
          previous: props.labels.pagePrevious,
          next: props.labels.pageNext,
          current: props.labels.pageCurrent,
        }}
      />
    </>
  );
}
