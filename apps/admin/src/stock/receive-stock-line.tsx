"use client";

import { Button, FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { InventoryItemPicker } from "./inventory-item-picker";
import type { ItemPickerLabels, ReceiveStockLabels } from "./stock-labels";
import { quantityInUnitWords } from "./stock-unit-text";
import type { ReceiptLine } from "./receive-stock-form-lib";

function QuantityHint(props: {
  line: ReceiptLine;
  unitLabel: (unitKey: string) => string;
}): ReactElement | null {
  if (props.line.item === undefined) return null;
  const quantity = Number(props.line.quantity.trim());
  if (!Number.isInteger(quantity) || quantity <= 0) return null;
  return (
    <p className="text-small text-secondary">
      {quantityInUnitWords(quantity, props.line.item.baseUnitKey, props.unitLabel)}
    </p>
  );
}

export function ReceiveStockLine(props: {
  organizationId: string;
  index: number;
  line: ReceiptLine;
  labels: ReceiveStockLabels;
  pickerLabels: ItemPickerLabels;
  unitLabel: (unitKey: string) => string;
  isSaving: boolean;
  canRemove: boolean;
  onChange: (changes: Partial<ReceiptLine>) => void;
  onRemove: () => void;
}): ReactElement {
  const { index, line, labels } = props;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3">
      <InventoryItemPicker
        organizationId={props.organizationId}
        id={`receive-item-${index}`}
        label={labels.item}
        value={line.item}
        labels={props.pickerLabels}
        disabled={props.isSaving}
        onChange={(item) => props.onChange({ item })}
      />
      <FormField label={labels.quantity} htmlFor={`receive-qty-${index}`}>
        <TextInput
          id={`receive-qty-${index}`}
          inputMode="numeric"
          value={line.quantity}
          disabled={props.isSaving}
          onChange={(event) => props.onChange({ quantity: event.target.value })}
        />
      </FormField>
      <QuantityHint line={line} unitLabel={props.unitLabel} />
      <FormField label={labels.unitCost} htmlFor={`receive-cost-${index}`}>
        <TextInput
          id={`receive-cost-${index}`}
          inputMode="decimal"
          value={line.unitCost}
          disabled={props.isSaving}
          onChange={(event) => props.onChange({ unitCost: event.target.value })}
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
