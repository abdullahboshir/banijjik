"use client";

import type { OfferingResponse } from "@banijjik/contracts/catalog";
import type { ResourceResponse, ResourceTimeOffResponse } from "@banijjik/contracts/booking";
import type { ComponentType, ReactElement } from "react";
import { LazySheetButton } from "../settings/lazy-sheet-button";
import type { ResourceFormSheetProps } from "./resource-form-sheet";

async function loadSheet(): Promise<ComponentType<ResourceFormSheetProps>> {
  const sheetModule = await import("./resource-form-sheet");
  return sheetModule.ResourceFormSheet;
}

export function ResourceFormButton(props: {
  label: string;
  sheetProps: Omit<ResourceFormSheetProps, "onClose">;
}): ReactElement {
  return <LazySheetButton label={props.label} load={loadSheet} sheetProps={props.sheetProps} />;
}

export type { ResourceResponse, ResourceTimeOffResponse, OfferingResponse };
