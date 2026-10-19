import type { UnitKey } from "@banijjik/contracts/catalog";
import type { Translator } from "@banijjik/i18n";
import { PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrgAccess } from "../shell/org-access";
import type { CatalogLookups } from "../catalog/catalog-lookups";
import { StockListPageActions } from "./stock-list-page-actions";
import { StockListPageBody } from "./stock-list-page-body";
import { StockListPageFilters } from "./stock-list-page-filters";
import type { StockListLabels, StockRowView } from "./stock-list";
import type { StockLabels } from "./stock-labels";
import type { StockQuery } from "./stock-query";

export function StockListPageView(props: {
  orgSlug: string;
  access: OrgAccess;
  lookups: CatalogLookups;
  query: StockQuery;
  locationId: string | undefined;
  labels: StockLabels;
  listLabels: StockListLabels;
  unitLabels: Record<UnitKey, string>;
  rows: StockRowView[];
  hasNext: boolean;
  canReceive: boolean;
  canAdjust: boolean;
  canCreateItem: boolean;
  t: Translator["t"];
}): ReactElement {
  const basePath = `/${props.orgSlug}/catalog/stock`;
  const queryWithLocation = { ...props.query, locationId: props.locationId };
  return (
    <PageLayout
      title={props.labels.title}
      subtitle={props.access.canWrite ? props.labels.subtitle : props.labels.readOnly}
      actions={
        <StockListPageActions
          access={props.access}
          lookups={props.lookups}
          locationId={props.locationId}
          labels={props.labels}
          unitLabels={props.unitLabels}
          canReceive={props.canReceive}
          canAdjust={props.canAdjust}
          canCreateItem={props.canCreateItem}
          t={props.t}
        />
      }
      filters={
        <StockListPageFilters
          basePath={basePath}
          query={queryWithLocation}
          lookups={props.lookups}
          labels={props.labels}
        />
      }
    >
      <StockListPageBody
        basePath={basePath}
        query={queryWithLocation}
        labels={props.labels}
        listLabels={props.listLabels}
        rows={props.rows}
        hasNext={props.hasNext}
        t={props.t}
      />
    </PageLayout>
  );
}
