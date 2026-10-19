"use client";

import type { LocationResponse } from "@banijjik/contracts";
import { FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { TransferLabels } from "./stock-labels";

export function TransferLocationFields(props: {
  fromLocationId: string;
  toLocationId: string;
  locations: readonly LocationResponse[];
  labels: TransferLabels;
  isSaving: boolean;
  onFromChange: (locationId: string) => void;
  onToChange: (locationId: string) => void;
}): ReactElement {
  return (
    <>
      <FormField label={props.labels.from} htmlFor="transfer-from">
        <Select
          id="transfer-from"
          value={props.fromLocationId}
          disabled={props.isSaving}
          onChange={(event) => props.onFromChange(event.target.value)}
        >
          {props.locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={props.labels.to} htmlFor="transfer-to">
        <Select
          id="transfer-to"
          value={props.toLocationId}
          disabled={props.isSaving}
          onChange={(event) => props.onToChange(event.target.value)}
        >
          {props.locations.map((location) => (
            <option key={location.locationId} value={location.locationId}>
              {location.name}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}
