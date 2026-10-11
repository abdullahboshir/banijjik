"use client";

import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { LocationFormSheetProps } from "./location-form-sheet";
import type { LocationFormLabels } from "./location-labels";
import { EMPTY_LOCATION_FORM } from "./location-state";

export interface NewLocationButtonProps {
  organizationId: string;
  label: string;
  variant?: "primary" | "secondary";
  labels: LocationFormLabels;
}

async function loadSheet(): Promise<ComponentType<LocationFormSheetProps>> {
  const sheetModule = await import("./location-form-sheet");
  return sheetModule.LocationFormSheet;
}

/** The "Add location" button; the form loads on the first tap. */
export function NewLocationButton(props: NewLocationButtonProps): ReactElement {
  return (
    <LazySheetButton
      label={props.label}
      {...(props.variant ? { variant: props.variant } : {})}
      load={loadSheet}
      sheetProps={{
        organizationId: props.organizationId,
        initial: EMPTY_LOCATION_FORM,
        labels: props.labels,
      }}
    />
  );
}
