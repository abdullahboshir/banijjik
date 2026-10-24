"use client";

import type { StockReceiptPaidVia } from "@banijjik/contracts/inventory";
import { FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ReceiveStockLabels } from "./stock-labels";

export function ReceiveStockPaidViaField(props: {
  readonly paidVia: StockReceiptPaidVia;
  readonly labels: ReceiveStockLabels;
  readonly isSaving: boolean;
  readonly error?: string | undefined;
  readonly onChange: (paidVia: StockReceiptPaidVia) => void;
}): ReactElement {
  return (
    <FormField label={props.labels.paidVia} htmlFor="receive-paid-via" error={props.error}>
      <Select
        id="receive-paid-via"
        value={props.paidVia}
        disabled={props.isSaving}
        onChange={(event) => props.onChange(event.target.value as StockReceiptPaidVia)}
      >
        {Object.entries(props.labels.paidViaOptions).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
