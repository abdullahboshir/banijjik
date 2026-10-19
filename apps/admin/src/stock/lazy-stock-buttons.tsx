"use client";

import type { LocationResponse } from "@banijjik/contracts";
import type { CurrencyCode } from "@banijjik/contracts";
import type { UnitKey } from "@banijjik/contracts/catalog";
import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { AdjustStockSheetProps } from "./adjust-stock-sheet";
import type { NewInventoryItemSheetProps } from "./new-inventory-item-sheet";
import type { ReceiveStockSheetProps } from "./receive-stock-sheet";
import type {
  AdjustStockLabels,
  ItemPickerLabels,
  NewItemLabels,
  ReceiveStockLabels,
} from "./stock-labels";

async function loadReceive(): Promise<ComponentType<ReceiveStockSheetProps>> {
  return (await import("./receive-stock-sheet")).ReceiveStockSheet;
}

async function loadAdjust(): Promise<ComponentType<AdjustStockSheetProps>> {
  return (await import("./adjust-stock-sheet")).AdjustStockSheet;
}

async function loadNewItem(): Promise<ComponentType<NewInventoryItemSheetProps>> {
  return (await import("./new-inventory-item-sheet")).NewInventoryItemSheet;
}

export function LazyReceiveStockButton(props: {
  label: string;
  organizationId: string;
  currency: CurrencyCode;
  locations: readonly LocationResponse[];
  defaultLocationId: string;
  labels: ReceiveStockLabels;
  pickerLabels: ItemPickerLabels;
  unitLabel: (unitKey: string) => string;
}): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      load={loadReceive}
      sheetProps={{
        organizationId: props.organizationId,
        currency: props.currency,
        locations: props.locations,
        defaultLocationId: props.defaultLocationId,
        labels: props.labels,
        pickerLabels: props.pickerLabels,
        unitLabel: props.unitLabel,
      }}
    />
  );
}

export function LazyAdjustStockButton(props: {
  label: string;
  organizationId: string;
  locations: readonly LocationResponse[];
  defaultLocationId: string;
  labels: AdjustStockLabels & { title: string; close: string };
  pickerLabels: ItemPickerLabels;
}): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      variant="secondary"
      load={loadAdjust}
      sheetProps={{
        organizationId: props.organizationId,
        locations: props.locations,
        defaultLocationId: props.defaultLocationId,
        labels: props.labels,
        pickerLabels: props.pickerLabels,
      }}
    />
  );
}

export function LazyNewInventoryItemButton(props: {
  label: string;
  organizationId: string;
  labels: NewItemLabels;
  unitLabels: Record<UnitKey, string>;
}): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      variant="secondary"
      load={loadNewItem}
      sheetProps={{
        organizationId: props.organizationId,
        labels: props.labels,
        unitLabels: props.unitLabels,
      }}
    />
  );
}
