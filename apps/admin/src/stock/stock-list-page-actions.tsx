import type { UnitKey } from "@banijjik/contracts/catalog";
import type { Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import type { OrgAccess } from "../shell/org-access";
import type { CatalogLookups } from "../catalog/catalog-lookups";
import {
  LazyAdjustStockButton,
  LazyNewInventoryItemButton,
  LazyReceiveStockButton,
} from "./lazy-stock-buttons";
import {
  adjustStockLabelsOf,
  itemPickerLabelsOf,
  newItemLabelsOf,
  receiveStockLabelsOf,
  type StockLabels,
} from "./stock-labels";

export function StockListPageActions(props: {
  access: OrgAccess;
  lookups: CatalogLookups;
  locationId: string | undefined;
  labels: StockLabels;
  unitLabels: Record<UnitKey, string>;
  canReceive: boolean;
  canAdjust: boolean;
  canCreateItem: boolean;
  t: Translator["t"];
}): ReactElement {
  const pickerLabels = itemPickerLabelsOf(props.t);
  const organizationId = props.access.organization.organizationId;
  return (
    <>
      {props.canCreateItem ? (
        <LazyNewInventoryItemButton
          label={props.labels.newItem}
          organizationId={organizationId}
          labels={newItemLabelsOf(props.t)}
          unitLabels={props.unitLabels}
        />
      ) : null}
      {props.canAdjust ? (
        <LazyAdjustStockButton
          label={props.labels.adjust}
          organizationId={organizationId}
          locations={props.lookups.locations}
          defaultLocationId={props.locationId ?? ""}
          labels={{
            ...adjustStockLabelsOf(props.t),
            title: props.t("stock.adjust.title"),
            close: props.t("stock.sheet.close"),
          }}
          pickerLabels={pickerLabels}
        />
      ) : null}
      {props.canReceive ? (
        <LazyReceiveStockButton
          label={props.labels.receive}
          organizationId={organizationId}
          currency={props.lookups.currency}
          locations={props.lookups.locations}
          defaultLocationId={props.locationId ?? ""}
          labels={receiveStockLabelsOf(props.t)}
          pickerLabels={pickerLabels}
          unitLabels={props.unitLabels}
        />
      ) : null}
    </>
  );
}
