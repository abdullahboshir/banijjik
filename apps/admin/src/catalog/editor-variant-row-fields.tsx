"use client";

import type { ReactElement } from "react";
import { TextField } from "./editor-fields";
import type { EditorLabels } from "./catalog-labels";
import type { VariantRow } from "./offering-form";

type OverrideField = "durationMinutes" | "billingCount" | "weightGrams";

export function EditorVariantRowFields(props: {
  row: VariantRow;
  index: number;
  labels: EditorLabels;
  currencySymbol: string;
  variantsError: string | undefined;
  overrideField: OverrideField | undefined;
  isReadOnly: boolean;
  onChange: (row: VariantRow) => void;
}): ReactElement {
  const { row, index, labels } = props;
  const overrideKey =
    props.overrideField === undefined
      ? undefined
      : (`options.override.${props.overrideField}` as const);
  return (
    <>
      <TextField
        id={`variant-${index}-price`}
        label={`${labels["field.price"]} (${props.currencySymbol})`}
        value={row.price}
        inputMode="decimal"
        error={props.variantsError}
        disabled={props.isReadOnly}
        onChange={(price) => props.onChange({ ...row, price })}
      />
      <TextField
        id={`variant-${index}-sku`}
        label={labels["field.sku"]}
        value={row.sku}
        disabled={props.isReadOnly}
        onChange={(sku) => props.onChange({ ...row, sku })}
      />
      <TextField
        id={`variant-${index}-barcode`}
        label={labels["field.barcode"]}
        value={row.barcode}
        disabled={props.isReadOnly}
        onChange={(barcode) => props.onChange({ ...row, barcode })}
      />
      {overrideKey ? (
        <TextField
          id={`variant-${index}-override`}
          label={labels[overrideKey]}
          value={row.override}
          inputMode="numeric"
          disabled={props.isReadOnly}
          onChange={(override) => props.onChange({ ...row, override })}
        />
      ) : null}
    </>
  );
}
