"use client";

import { Button } from "@banijjik/ui";
import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { PosDeviceAddSheetProps } from "./pos-device-add-sheet";
import type { PosDeviceAddLabels } from "./pos-devices-labels";

export interface PosDeviceAddButtonProps {
  organizationId: string;
  labels: PosDeviceAddLabels;
  locations: PosDeviceAddSheetProps["locations"];
  defaultLocationId: string | undefined;
  /** True at the package limit: the button is off and the page shows the limit notice. */
  isOff: boolean;
}

async function loadSheet(): Promise<ComponentType<PosDeviceAddSheetProps>> {
  const sheetModule = await import("./pos-device-add-sheet");
  return sheetModule.PosDeviceAddSheet;
}

/** "Add device". Off when the package is full or the business has no location to put a till at. */
export function PosDeviceAddButton(props: PosDeviceAddButtonProps): ReactElement {
  const { organizationId, labels, locations, defaultLocationId, isOff } = props;
  if (isOff || locations.length === 0) {
    return <Button disabled>{labels.add}</Button>;
  }
  return (
    <LazySheetButton
      label={labels.add}
      load={loadSheet}
      sheetProps={{ organizationId, locations, defaultLocationId, labels }}
    />
  );
}
