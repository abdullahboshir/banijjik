"use client";

import type { ReactElement } from "react";
import { LocationArchiveDialog } from "./location-archive-dialog";
import { LocationFormSheet } from "./location-form-sheet";
import type { LocationArchiveLabels, LocationFormLabels } from "./location-labels";
import type { LocationFormState } from "./location-state";

export type LocationRowAction = "edit" | "archive";

export interface LocationDialogsProps {
  organizationId: string;
  location: { locationId: string; version: number; form: LocationFormState };
  action: LocationRowAction;
  formLabels: LocationFormLabels;
  archiveLabels: LocationArchiveLabels;
  onClose: () => void;
}

/** Loaded on the first tap of a row action, so none of this is in the first load of the route. */
export function LocationDialogs(props: LocationDialogsProps): ReactElement {
  const { organizationId, location, onClose } = props;
  if (props.action === "edit") {
    return (
      <LocationFormSheet
        organizationId={organizationId}
        initial={location.form}
        location={{ locationId: location.locationId, version: location.version }}
        labels={props.formLabels}
        onClose={onClose}
      />
    );
  }
  return (
    <LocationArchiveDialog
      organizationId={organizationId}
      locationId={location.locationId}
      version={location.version}
      labels={props.archiveLabels}
      onClose={onClose}
    />
  );
}
