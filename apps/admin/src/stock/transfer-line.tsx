"use client";

import { Button, FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { InventoryItemPicker } from "./inventory-item-picker";
import type { ItemPickerLabels, TransferLabels } from "./stock-labels";
import type { TransferLine } from "./transfer-form-lib";

export function TransferLineEditor(props: {
  organizationId: string;
  index: number;
  line: TransferLine;
  labels: TransferLabels;
  pickerLabels: ItemPickerLabels;
  isSaving: boolean;
  canRemove: boolean;
  onChange: (changes: Partial<TransferLine>) => void;
  onRemove: () => void;
}): ReactElement {
  const { index, line, labels } = props;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3">
      <InventoryItemPicker
        organizationId={props.organizationId}
        id={`transfer-item-${index}`}
        label={labels.item}
        value={line.item}
        labels={props.pickerLabels}
        disabled={props.isSaving}
        onChange={(item) => props.onChange({ item })}
      />
      <FormField label={labels.quantity} htmlFor={`transfer-qty-${index}`}>
        <TextInput
          id={`transfer-qty-${index}`}
          inputMode="numeric"
          value={line.quantity}
          disabled={props.isSaving}
          onChange={(event) => props.onChange({ quantity: event.target.value })}
        />
      </FormField>
      {props.canRemove ? (
        <Button
          type="button"
          variant="secondary"
          disabled={props.isSaving}
          onClick={props.onRemove}
        >
          {labels.removeLine}
        </Button>
      ) : null}
    </div>
  );
}
