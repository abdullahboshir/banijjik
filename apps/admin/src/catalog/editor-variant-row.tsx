"use client";

import type { UnitKey } from "@banijjik/contracts/catalog";
import type { ReactElement } from "react";
import type { VariantsProps } from "./editor-variants";
import { EditorVariantRowFields } from "./editor-variant-row-fields";
import { overrideFieldOf, type StockComponentDraft, type VariantRow } from "./offering-form";
import { isProductKind } from "./stock-component-field";
import { StockFromSection } from "./stock-from-section";
import { variantNameOf } from "./variant-generator";

export function EditorVariantRow(props: {
  row: VariantRow;
  index: number;
  variantsProps: VariantsProps;
  onChange: (row: VariantRow) => void;
}): ReactElement {
  const { row, index } = props;
  const {
    form,
    labels,
    errors,
    isReadOnly,
    currencySymbol,
    organizationId,
    unitNames,
    stockPickerLabels,
  } = props.variantsProps;
  const overrideField = overrideFieldOf(form.kind);
  function setComponents(components: StockComponentDraft[]): void {
    props.onChange({ ...row, stockComponents: components });
  }
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default p-3">
      <p className="text-body font-semibold text-primary">{variantNameOf(row.optionValues)}</p>
      <EditorVariantRowFields
        row={row}
        index={index}
        labels={labels}
        currencySymbol={currencySymbol}
        variantsError={errors["variants"]}
        overrideField={overrideField}
        isReadOnly={isReadOnly}
        onChange={props.onChange}
      />
      {isProductKind(form.kind) ? (
        <StockFromSection
          organizationId={organizationId}
          rowIndex={index}
          stockComponents={row.stockComponents}
          labels={labels}
          pickerLabels={stockPickerLabels}
          unitLabel={(unitKey: UnitKey) => unitNames[unitKey]}
          isReadOnly={isReadOnly}
          onChange={setComponents}
        />
      ) : null}
    </li>
  );
}
