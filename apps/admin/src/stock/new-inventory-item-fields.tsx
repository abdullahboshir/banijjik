"use client";

import { UNIT_KEY, type UnitKey } from "@banijjik/contracts/catalog";
import { FormField, Select, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { NewItemLabels } from "./stock-labels";

export function NewInventoryItemFields(props: {
  labels: NewItemLabels;
  name: string;
  sku: string;
  baseUnitKey: UnitKey;
  unitLabels: Record<UnitKey, string>;
  isSaving: boolean;
  onNameChange: (value: string) => void;
  onSkuChange: (value: string) => void;
  onUnitChange: (value: UnitKey) => void;
}): ReactElement {
  return (
    <>
      <FormField label={props.labels.name} htmlFor="item-name">
        <TextInput
          id="item-name"
          value={props.name}
          disabled={props.isSaving}
          onChange={(event) => props.onNameChange(event.target.value)}
        />
      </FormField>
      <FormField label={props.labels.sku} htmlFor="item-sku">
        <TextInput
          id="item-sku"
          value={props.sku}
          disabled={props.isSaving}
          onChange={(event) => props.onSkuChange(event.target.value)}
        />
      </FormField>
      <FormField label={props.labels.unit} htmlFor="item-unit">
        <Select
          id="item-unit"
          value={props.baseUnitKey}
          disabled={props.isSaving}
          onChange={(event) => props.onUnitChange(event.target.value as UnitKey)}
        >
          {Object.values(UNIT_KEY).map((unitKey) => (
            <option key={unitKey} value={unitKey}>
              {props.unitLabels[unitKey]}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}
