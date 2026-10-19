"use client";

import type { UnitKey } from "@banijjik/contracts/catalog";
import { Button } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ItemPickerLabels } from "../stock/stock-labels";
import type { EditorLabels } from "./catalog-labels";
import type { StockComponentDraft } from "./offering-form";
import { StockComponentField } from "./stock-component-field";

const EMPTY_COMPONENT: StockComponentDraft = { inventoryItemId: "", quantity: "" };

function displayComponents(components: StockComponentDraft[]): StockComponentDraft[] {
  return components.length > 0 ? components : [EMPTY_COMPONENT];
}

export function StockFromSection(props: {
  organizationId: string;
  rowIndex: number;
  stockComponents: StockComponentDraft[];
  labels: EditorLabels;
  pickerLabels: ItemPickerLabels;
  unitLabel: (unitKey: UnitKey) => string;
  isReadOnly: boolean;
  onChange: (components: StockComponentDraft[]) => void;
}): ReactElement {
  const rows = displayComponents(props.stockComponents);
  function updateAt(index: number, changed: StockComponentDraft): void {
    const base = displayComponents(props.stockComponents);
    props.onChange(base.map((item, at) => (at === index ? changed : item)));
  }
  return (
    <div className="flex flex-col gap-2 border-t border-default pt-2">
      <p className="text-small font-semibold text-secondary">{props.labels["stockFrom.title"]}</p>
      {rows.map((component, componentIndex) => (
        <StockComponentField
          key={componentIndex}
          organizationId={props.organizationId}
          index={componentIndex}
          rowIndex={props.rowIndex}
          component={component}
          labels={props.labels}
          pickerLabels={props.pickerLabels}
          unitLabel={props.unitLabel}
          isReadOnly={props.isReadOnly}
          onChange={(changed) => updateAt(componentIndex, changed)}
        />
      ))}
      {!props.isReadOnly ? (
        <Button
          variant="secondary"
          onClick={() =>
            props.onChange([...props.stockComponents, { inventoryItemId: "", quantity: "" }])
          }
        >
          {props.labels["stockFrom.add"]}
        </Button>
      ) : null}
    </div>
  );
}
