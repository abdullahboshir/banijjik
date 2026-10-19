"use client";

import type { LocationResponse } from "@banijjik/contracts";
import { FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { ReceiveStockLabels } from "./stock-labels";

export function ReceiveStockLocationField(props: {
  locationId: string;
  locations: readonly LocationResponse[];
  labels: ReceiveStockLabels;
  isSaving: boolean;
  onChange: (locationId: string) => void;
}): ReactElement {
  return (
    <FormField label={props.labels.location} htmlFor="receive-location">
      <Select
        id="receive-location"
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
