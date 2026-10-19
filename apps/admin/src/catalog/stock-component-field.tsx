"use client";

import { OFFERING_KIND } from "@banijjik/contracts";
import type { UnitKey } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import { InventoryItemPicker } from "../stock/inventory-item-picker";
import type { ItemPickerLabels } from "../stock/stock-labels";
import { quantityInUnitWords } from "../stock/stock-unit-text";
import type { EditorLabels } from "./catalog-labels";
import type { StockComponentDraft } from "./offering-form";
import { TextField } from "./editor-fields";
import { useStockComponentItem } from "./use-stock-component-item";

export function StockComponentField(props: {
  organizationId: string;
  index: number;
  rowIndex: number;
  component: StockComponentDraft;
  labels: EditorLabels;
  pickerLabels: ItemPickerLabels;
  unitLabel: (unitKey: UnitKey) => string;
  isReadOnly: boolean;
  onChange: (component: StockComponentDraft) => void;
}): ReactElement {
  const item = useStockComponentItem(props.organizationId, props.component, props.onChange);

  const quantity = Number(props.component.quantity.trim());
  const hint =
    item !== undefined && Number.isInteger(quantity) && quantity > 0
      ? quantityInUnitWords(quantity, item.baseUnitKey, props.unitLabel)
      : undefined;

  return (
    <div className="flex flex-col gap-2">
      <InventoryItemPicker
        organizationId={props.organizationId}
        id={`variant-${props.rowIndex}-stock-item-${props.index}`}
        label={props.labels["stockFrom.item"]}
        value={item}
        labels={props.pickerLabels}
        disabled={props.isReadOnly}
        onChange={(picked) => {
          props.onChange({
            ...props.component,
            item: picked,
            inventoryItemId: picked?.inventoryItemId ?? "",
          });
        }}
      />
      <TextField
        id={`variant-${props.rowIndex}-stock-qty-${props.index}`}
        label={props.labels["stockFrom.quantity"]}
        value={props.component.quantity}
        inputMode="numeric"
        hint={props.labels["stockFrom.quantityHint"]}
        disabled={props.isReadOnly}
        onChange={(quantityText) => props.onChange({ ...props.component, quantity: quantityText })}
      />
      {hint ? <p className="text-small text-secondary">{hint}</p> : null}
    </div>
  );
}

export function isProductKind(kind: string): boolean {
  return kind === OFFERING_KIND.PRODUCT;
}
