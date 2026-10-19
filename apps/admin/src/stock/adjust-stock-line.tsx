"use client";

import type { LocationResponse } from "@banijjik/contracts";
import { STOCK_ADJUSTMENT_REASON } from "@banijjik/contracts/inventory";
import { Button, FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { AdjustStockLabels, ItemPickerLabels } from "./stock-labels";
import { InventoryItemPicker } from "./inventory-item-picker";
import type { AdjustLine } from "./adjust-stock-form-lib";

function AdjustLineExtras(props: {
  index: number;
  line: AdjustLine;
  labels: AdjustStockLabels;
  isSaving: boolean;
  onChange: (changes: Partial<AdjustLine>) => void;
}): ReactElement {
  const { index, line, labels } = props;
  return (
    <>
      <FormField label={labels.reason} htmlFor={`adjust-reason-${index}`}>
        <Select
          id={`adjust-reason-${index}`}
          value={line.reason}
          disabled={props.isSaving}
          onChange={(event) =>
            props.onChange({ reason: event.target.value as AdjustLine["reason"] })
          }
        >
          <option value={STOCK_ADJUSTMENT_REASON.ADJUSTMENT}>{labels.reasonAdjustment}</option>
          <option value={STOCK_ADJUSTMENT_REASON.DAMAGE_WRITE_OFF}>{labels.reasonDamage}</option>
        </Select>
      </FormField>
      <FormField label={labels.note} htmlFor={`adjust-note-${index}`}>
        <TextInput
          id={`adjust-note-${index}`}
          value={line.note}
          disabled={props.isSaving}
          onChange={(event) => props.onChange({ note: event.target.value })}
        />
      </FormField>
    </>
  );
}

export function AdjustStockLine(props: {
  organizationId: string;
  index: number;
  line: AdjustLine;
  labels: AdjustStockLabels;
  pickerLabels: ItemPickerLabels;
  isSaving: boolean;
  canRemove: boolean;
  onChange: (changes: Partial<AdjustLine>) => void;
  onRemove: () => void;
}): ReactElement {
  const { index, line, labels } = props;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-default p-3">
      <InventoryItemPicker
        organizationId={props.organizationId}
        id={`adjust-item-${index}`}
        label={labels.item}
        value={line.item}
        labels={props.pickerLabels}
        disabled={props.isSaving}
        onChange={(item) => props.onChange({ item })}
      />
      <FormField label={labels.quantityDelta} htmlFor={`adjust-delta-${index}`}>
        <TextInput
          id={`adjust-delta-${index}`}
          inputMode="numeric"
          value={line.quantityDelta}
          disabled={props.isSaving}
          onChange={(event) => props.onChange({ quantityDelta: event.target.value })}
        />
      </FormField>
      <AdjustLineExtras
        index={index}
        line={line}
        labels={labels}
        isSaving={props.isSaving}
        onChange={props.onChange}
      />
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

export function AdjustLocationField(props: {
  locationId: string;
  locations: readonly LocationResponse[];
  labels: AdjustStockLabels;
  isSaving: boolean;
  onChange: (locationId: string) => void;
}): ReactElement {
  return (
    <FormField label={props.labels.location} htmlFor="adjust-location">
      <Select
        id="adjust-location"
        value={props.locationId}
        disabled={props.isSaving}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.locations.map((location) => (
          <option key={location.locationId} value={location.locationId}>
            {location.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
